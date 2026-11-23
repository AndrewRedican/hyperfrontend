/**
 * Consumer E2E tests for the `service` executor of `@hyperfrontend/workspace`.
 *
 * An empty repository outside this one is made a workspace by the installed `hf`, a service is generated into it and
 * built on the kernel the consumer installs from the registry. The built directory is then run as a process of its
 * own under plain Node: it boots with the digest the build printed, answers, stops, and refuses to boot beside bytes
 * the build did not write. The same service also runs from source, and the build refuses the sources and the main a
 * built service could not run as written.
 */

import type { ChildProcess } from 'node:child_process'
import type { ConsumerRun } from '@hyperfrontend/testing/consumer'
import type { ChildExit } from '@hyperfrontend/testing/process'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { after, before, it as nodeIt } from 'node:test'
import { describe, expect, it, waitUntil } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'
import { cleanSignalExit } from '@hyperfrontend/testing/process'

/** A process the suite started, with what it wrote. */
interface Service {
  /** The process. */
  readonly child: ChildProcess
  /** Reads everything written to standard output so far. */
  readonly stdout: () => string
  /** Reads everything written to standard error so far. */
  readonly stderr: () => string
  /** Reads how the process ended, once it has and both streams have closed. */
  readonly exit: () => ChildExit | undefined
  /** Whether the process leads a group of its own, so that what it started can be ended with it. */
  readonly group: boolean
}

/** One file of a release manifest. */
interface ReleaseFile {
  /** The path below the directory, with `/` separators. */
  readonly path: string
  /** The size in bytes. */
  readonly size: number
  /** The SHA-256 of the bytes, in hexadecimal. */
  readonly sha256: string
}

// note: 30s bounds every wait on a line or an exit: slack for slow CI hosts, and inside the timeout of the format, so a wait that fails says what the process wrote.
const WAIT_MS = 30000

/** The variables the generated service declares, which the machine running the suite may not hand to it. */
const DECLARED_VARIABLES = ['PORT', 'HOST']

/** The immutable section the service is built with. */
const SECTION = { greeting: 'Hello', limits: { names: 3 } }

/** The directory the build writes, relative to the consumer. */
const OUTPUT = 'dist/apps/hello'

// note: Windows delivers no signal to a child and keeps no executable bit on a file, so the cases that read either run elsewhere.
const itOffWindows = process.platform !== 'win32' ? it : it.skip

const consumer = usePackedConsumer({
  tarball: process.env['HF_E2E_TARBALL'],
  peers: [
    'typescript@5.7.3',
    '@types/node@25.3.3',
    '@hyperfrontend/testing@0.5.1',
    '@hyperfrontend/linter@0.3.1',
    'prettier@3.8.0',
    '@hyperfrontend/server@0.2.0',
  ],
})

/** Every process the suite started, so that none outlives it. */
const started: Service[] = []

/** What the first build of the service reported. */
let built: ConsumerRun

/**
 * Runs the installed executable in the consumer.
 *
 * @param args - The arguments after `hf`
 * @returns What the run reported
 */
function hf(args: readonly string[]): ConsumerRun {
  return consumer.node([join(consumer.path, 'node_modules', '@hyperfrontend', 'workspace', 'bin', 'hf.mjs'), ...args], { timeout: 600_000 })
}

/**
 * A file of the consumer.
 *
 * @param path - The file, relative to the consumer
 * @returns Its text
 */
function read(path: string): string {
  return readFileSync(join(consumer.path, path), 'utf8')
}

/**
 * A JSON file of the consumer.
 *
 * @param path - The file, relative to the consumer
 * @returns Its value
 */
function readJson<Value>(path: string): Value {
  return JSON.parse(read(path)) as Value
}

/**
 * Hashes bytes with SHA-256.
 *
 * @param bytes - The bytes, or a text hashed as UTF-8
 * @returns The digest in hexadecimal
 */
function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Every file under a directory of the consumer.
 *
 * @param directory - The directory, relative to the consumer
 * @returns The files, relative to the directory with `/` separators, in order
 */
function filesUnder(directory: string): string[] {
  const root = join(consumer.path, directory)
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(root.length + 1)
        .split(sep)
        .join('/')
    )
    .sort()
}

/**
 * The digests a build printed.
 *
 * @param run - What the build reported
 * @returns The digest of the release and of the immutable section, or undefined when the build printed no such line
 */
function printedDigests(run: ConsumerRun): { release: string; immutable: string } | undefined {
  const match = /^built hello release=([0-9a-f]{64}) immutable=([0-9a-f]{64})$/m.exec(run.stdout)
  return match === null ? undefined : { release: match[1] as string, immutable: match[2] as string }
}

/**
 * Builds the environment a service inherits: this process's, without the variables the service declares and without the test runner's own.
 *
 * @returns Variables for a child that reads only what the suite sets
 */
function inheritedEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !DECLARED_VARIABLES.includes(name.toUpperCase()) && name !== 'NODE_TEST_CONTEXT' && !name.startsWith('HF_TEST_')
    )
  )
}

/**
 * Starts a process of its own under plain Node.
 *
 * @param args - The arguments after `node`
 * @param env - The variables set over the inherited ones
 * @param starter - Whether the process starts others through a shell: it then gets no IPC channel, whose variable they would inherit without the channel, and leads a process group of its own, so that the suite can end everything it started
 * @returns The process and readers of what it writes
 */
function startNode(args: readonly string[], env: NodeJS.ProcessEnv = {}, starter = false): Service {
  const child = spawn(process.execPath, [...args], {
    cwd: consumer.path,
    env: { ...inheritedEnvironment(), PORT: '0', HOST: '127.0.0.1', ...env },
    stdio: starter ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe', 'ipc'],
    detached: starter,
  })
  let stdout = ''
  let stderr = ''
  let exit: ChildExit | undefined
  let openStreams = 2
  const closed = (): void => {
    openStreams -= 1
  }
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
  // why: Node never emits 'close' for a child whose channel this process disconnected, so the end is the exit and the close of both streams.
  child.stdout?.once('close', closed)
  child.stderr?.once('close', closed)
  child.once('exit', (code, signal) => {
    exit = { code, signal }
  })
  const service = { child, stdout: () => stdout, stderr: () => stderr, exit: () => (openStreams === 0 ? exit : undefined), group: starter }
  started.push(service)
  return service
}

/**
 * Starts the main of a built directory.
 *
 * @param directory - The built directory, relative to the consumer
 * @param env - The variables set over the inherited ones
 * @returns The process and readers of what it writes
 */
function startMain(directory: string, env: NodeJS.ProcessEnv = {}): Service {
  return startNode([join(consumer.path, directory, 'main.cjs')], env)
}

/**
 * Waits for something a process shows: a line, or its end.
 *
 * @param service - The process
 * @param what - What is waited for, for the failure
 * @param readValue - Reads it; a falsy value says it is not there yet
 * @returns What was read
 */
async function observed<Value>(service: Service, what: string, readValue: () => Value): Promise<NonNullable<Value>> {
  let ended = false
  try {
    return await waitUntil(
      () => {
        const value = readValue()
        ended = !value && service.exit() !== undefined
        if (ended) throw new Error(what)
        return value
      },
      { timeout: WAIT_MS, interval: 10 }
    )
  } catch {
    const reason = ended ? 'the process ended first' : `${WAIT_MS} ms passed`
    throw new Error(`${what} did not show: ${reason}.\nstandard output:\n${service.stdout()}\nstandard error:\n${service.stderr()}`)
  }
}

/**
 * Waits for the started line of a service.
 *
 * @param service - The process
 * @returns What the service printed once it listened, without its line ending
 */
function startedLine(service: Service): Promise<string> {
  return observed(service, 'the started line', () =>
    service
      .stdout()
      .split(/\r?\n/)
      .slice(0, -1)
      .find((written) => written.split(' ')[0] === 'started')
  )
}

/**
 * Waits for a service to listen.
 *
 * @param service - The process
 * @returns The address its routes answer at
 */
async function listening(service: Service): Promise<string> {
  return `http://127.0.0.1:${/ port=(\d+)/.exec(await startedLine(service))?.[1]}`
}

/**
 * Waits for the end of a process.
 *
 * @param service - The process
 * @returns Its exit code or the signal that ended it
 */
function ended(service: Service): Promise<ChildExit> {
  return observed(service, 'the end of the process', service.exit)
}

/**
 * Closes the channel to a service and waits for it to stop.
 *
 * @param service - The process
 * @returns How it ended, and whether it printed the stopped line
 */
async function disconnected(service: Service): Promise<{ exit: ChildExit; stopped: boolean }> {
  service.child.disconnect()
  return { exit: await ended(service), stopped: service.stdout().split(/\r?\n/).includes('stopped') }
}

/**
 * Copies the built directory, so a test can change the copy and leave the build as it was.
 *
 * @param name - What the copy's directory is called under `dist`
 * @returns The copy's directory, relative to the consumer
 */
function copyOfBuild(name: string): string {
  cpSync(join(consumer.path, OUTPUT), join(consumer.path, 'dist', name), { recursive: true })
  return join('dist', name)
}

before(() => {
  // why: npm wrote the consumer's manifest for the install; the scope the generators read comes from the name the repository gives itself
  consumer.write('package.json', { ...readJson<Record<string, unknown>>('package.json'), name: '@acme/monorepo', license: 'MIT' })
  execFileSync('git', ['init', '-q'], { cwd: consumer.path })
  hf(['generate', 'workspace'])
  hf(['generate', 'service', 'hello'])
  writeFileSync(
    join(consumer.path, 'apps', 'hello', 'src', 'assets.ts'),
    "export const assetsUrl = new URL('./assets/', import.meta.url)\n"
  )
  consumer.write(join('apps', 'hello', 'src', 'assets', 'notice.txt'), 'a notice\n')
  const project = readJson<{ targets: { build: Record<string, unknown> } }>('apps/hello/project.json')
  project.targets.build = { ...project.targets.build, options: { assets: ['assets/**'] } }
  consumer.write(join('apps', 'hello', 'project.json'), project)
  consumer.write(join('apps', 'hello', 'service.config.ts'), `export default { immutable: ${JSON.stringify(SECTION)} }\n`)
  built = hf(['run', 'hello:build'])
})

/**
 * Ends every process the suite left running and waits until each is gone.
 * It is registered inside the suites that start processes, so that it runs before the consumer's directory is removed: a live process holds its working directory, and on Windows the removal would be refused and nothing after it would run.
 */
async function endStarted(): Promise<void> {
  for (const service of started) {
    if (service.exit() !== undefined) continue
    try {
      // why: a kill reaches one process, and what a starter started holds its streams open, so its whole group is ended
      if (service.group && service.child.pid !== undefined) process.kill(-service.child.pid, 'SIGKILL')
      else service.child.kill('SIGKILL')
      await ended(service)
    } catch {
      // why: one process that cannot be ended must not keep the others from being ended
    }
  }
}

describe('hf run <service>:build', () => {
  it('builds, and prints the digests of the release and of the immutable section on one line', () => {
    expect({ status: built.status, digests: printedDigests(built), output: built.stdout + built.stderr }).toEqual({
      status: 0,
      digests: { release: expect.any(String), immutable: expect.any(String) },
      output: expect.any(String),
    })
  })

  it('writes exactly the main, the two manifests and the asset', () => {
    expect(filesUnder(OUTPUT)).toEqual(['assets/notice.txt', 'hf-release.json', 'main.cjs', 'service.manifest.json'])
  })

  it('lists every file but the release manifest, with its size and SHA-256', () => {
    const listed = ['assets/notice.txt', 'main.cjs', 'service.manifest.json'].map((path) => {
      const bytes = readFileSync(join(consumer.path, OUTPUT, path))
      return { path, size: bytes.length, sha256: sha256(bytes) }
    })
    expect(readJson<{ files: ReleaseFile[] }>(`${OUTPUT}/hf-release.json`).files).toEqual(listed)
  })

  it.each(['hf-release.json', 'service.manifest.json'])('stores %s in canonical form', (file) => {
    expect(read(`${OUTPUT}/${file}`)).toBe(`${JSON.stringify(readJson(`${OUTPUT}/${file}`), null, 2)}\n`)
  })

  it('states the immutable section and its digest in the service manifest', () => {
    expect(readJson(`${OUTPUT}/service.manifest.json`)).toEqual({
      schema: 1,
      immutable: { digest: sha256(JSON.stringify(SECTION)), value: SECTION },
    })
  })

  it('prints the digest of the release manifest it wrote', () => {
    expect(printedDigests(built)?.release).toBe(sha256(readFileSync(join(consumer.path, OUTPUT, 'hf-release.json'))))
  })

  it('prints the digest of the immutable section it stated', () => {
    expect(printedDigests(built)?.immutable).toBe(sha256(JSON.stringify(SECTION)))
  })

  nodeIt('builds the same bytes twice, into another directory', (t) => {
    const release = printedDigests(hf(['run', 'hello:build', '--outputPath=dist/again']))?.release
    // why: the three platforms' lines, read side by side from one pipeline run, say whether a build is the same bytes on every operating system
    t.diagnostic(`service release sha256 on ${process.platform}: ${release}`)
    expect(release).toBe(printedDigests(built)?.release)
  })

  it('carries no path of the machine that built it', () => {
    const main = read(`${OUTPUT}/main.cjs`)
    expect([consumer.path, consumer.path.split(sep).join('/')].filter((path) => main.includes(path))).toEqual([])
  })

  itOffWindows('makes the main executable', () => {
    // why: Windows, the one platform where a signal does not arrive, is also the one whose file system keeps no executable bit
    expect(statSync(join(consumer.path, OUTPUT, 'main.cjs')).mode & 0o111).toBe(0o111)
  })
})

describe('a built service', () => {
  after(endStarted)

  it('starts from the built directory, with the digest of its release in the started line', async () => {
    const service = startMain(OUTPUT)
    const line = await startedLine(service)
    await disconnected(service)
    expect(line.replace(/ port=\d+ /, ' port=<n> ')).toBe(
      `started port=<n> release=${sha256(readFileSync(join(consumer.path, OUTPUT, 'hf-release.json')))}`
    )
  })

  it('answers a routed request', async () => {
    const service = startMain(OUTPUT)
    const response = await fetch(`${await listening(service)}/hello/world`)
    const answer = { status: response.status, body: await response.json() }
    await disconnected(service)
    expect(answer).toEqual({ status: 200, body: { message: 'Hello, world' } })
  })

  it('answers /healthz', async () => {
    const service = startMain(OUTPUT)
    const response = await fetch(`${await listening(service)}/healthz`)
    const answer = { status: response.status, body: (await response.text()).trim() }
    await disconnected(service)
    expect(answer).toEqual({ status: 200, body: 'ok' })
  })

  it('stops with exit code 0 when its channel closes', async () => {
    const service = startMain(OUTPUT)
    await startedLine(service)
    expect(await disconnected(service)).toEqual({ exit: { code: 0, signal: null }, stopped: true })
  })

  itOffWindows('stops on SIGTERM', async () => {
    const service = startMain(OUTPUT)
    await startedLine(service)
    service.child.kill('SIGTERM')
    expect(await ended(service)).toEqual(cleanSignalExit('SIGTERM'))
  })

  it('refuses to boot beside a changed asset, and names it', async () => {
    const copy = copyOfBuild('changed')
    appendFileSync(join(consumer.path, copy, 'assets', 'notice.txt'), '!')
    const service = startMain(copy)
    expect({ exit: await ended(service), stdout: service.stdout(), stderr: service.stderr() }).toEqual({
      exit: { code: 78, signal: null },
      stdout: '',
      stderr: expect.stringMatching(/^fatal cause=release\r?\n {2}- assets\/notice\.txt /),
    })
  })

  it('refuses to boot beside a file the build did not write, and names it', async () => {
    const copy = copyOfBuild('unlisted')
    consumer.write(join(copy, 'extra.txt'), 'one more')
    const service = startMain(copy)
    expect({ exit: await ended(service), stdout: service.stdout(), stderr: service.stderr() }).toEqual({
      exit: { code: 78, signal: null },
      stdout: '',
      stderr: expect.stringMatching(/^fatal cause=release\r?\n {2}- extra\.txt /),
    })
  })

  it('refuses to boot on a malformed variable, without printing its value', async () => {
    const service = startMain(OUTPUT, { PORT: 'not-a-port-marker' })
    const exit = await ended(service)
    expect({ exit, stdout: service.stdout(), stderr: service.stderr(), printed: service.stderr().includes('not-a-port-marker') }).toEqual({
      exit: { code: 78, signal: null },
      stdout: '',
      stderr: expect.stringMatching(/^fatal cause=environment\r?\n/),
      printed: false,
    })
  })
})

describe('the same service from source', () => {
  after(endStarted)

  it('runs without a build, with no release in its started line, and stops with exit code 0', async () => {
    const service = startNode(['--import', '@hyperfrontend/workspace/hooks', join('apps', 'hello', 'src', 'main.ts')])
    const line = await startedLine(service)
    expect({ line, ...(await disconnected(service)) }).toEqual({
      line: expect.stringMatching(/^started port=\d+$/),
      exit: { code: 0, signal: null },
      stopped: true,
    })
  })
})

describe('hf run <service>:dev', () => {
  after(endStarted)

  it('starts the service from source through the generated target, which a malformed variable ends before it listens', () => {
    // why: a run that ends by itself proves the command line the target wrote, with its quoted root, on the shell of every platform, and leaves no process behind
    const run = consumer.node([join(consumer.path, 'node_modules', '@hyperfrontend', 'workspace', 'bin', 'hf.mjs'), 'run', 'hello:dev'], {
      env: { PORT: 'not-a-port-marker' },
      timeout: 120_000,
    })
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({
      status: 1,
      output: expect.stringContaining('fatal cause=environment'),
    })
  })

  itOffWindows('stops the service it started, and exits 0, when it is sent a terminate signal', async () => {
    const run = startNode(
      [join(consumer.path, 'node_modules', '@hyperfrontend', 'workspace', 'bin', 'hf.mjs'), 'run', 'hello:dev'],
      {},
      true
    )
    await startedLine(run)
    run.child.kill('SIGTERM')
    expect({ exit: await ended(run), stopped: run.stdout().split(/\r?\n/).includes('stopped') }).toEqual({
      exit: { code: 0, signal: null },
      stopped: true,
    })
  })
})

describe('a service the build refuses', () => {
  it('refuses a nested module that forms a URL from import.meta.url, and leaves the earlier build as it was', () => {
    const earlier = filesUnder(OUTPUT).map((file) => sha256(readFileSync(join(consumer.path, OUTPUT, file))))
    consumer.write(
      join('apps', 'hello', 'src', 'routes', 'notice.ts'),
      "export const notice = new URL('../assets/notice.txt', import.meta.url)\n"
    )
    const run = hf(['run', 'hello:build'])
    rmSync(join(consumer.path, 'apps', 'hello', 'src', 'routes'), { recursive: true })
    expect({
      status: run.status,
      output: run.stdout + run.stderr,
      after: filesUnder(OUTPUT).map((file) => sha256(readFileSync(join(consumer.path, OUTPUT, file)))),
    }).toEqual({
      status: 1,
      output: expect.stringContaining('apps/hello/src/routes/notice.ts:1 uses import.meta.url below src/'),
      after: earlier,
    })
  })

  it('refuses a main that does not run through the runner, and leaves no output', () => {
    // why: this rewrites the entry module, so it is the last build of the suite
    consumer.write(join('apps', 'hello', 'src', 'main.ts'), "process.stdout.write('hello\\n')\n")
    const run = hf(['run', 'hello:build'])
    expect({ status: run.status, output: run.stdout + run.stderr, left: existsSync(join(consumer.path, OUTPUT)) }).toEqual({
      status: 1,
      output: expect.stringContaining('apps/hello/src/main.ts does not run the service through runService of @hyperfrontend/server'),
      left: false,
    })
  })
})
