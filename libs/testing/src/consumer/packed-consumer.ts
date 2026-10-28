import type { FileContent, FileTree } from '../fs/write-tree'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'
import { after, before } from 'node:test'
import { createTempDir } from '../fs/temp-dir'
import { writeFile, writeTree } from '../fs/write-tree'

/**
 * Which module system a child process loads the package through.
 */
export type ModuleKind = 'import' | 'require'

/**
 * What to install and how long to wait for it.
 */
export type PackedConsumerOptions = {
  /** Absolute path of the packed tarball (`npm pack` output). Required; `undefined` is accepted so an environment variable can be passed straight through, and reported when missing. */
  tarball: string | undefined
  /** Packages installed beside the tarball, as `name@version` specifiers: the peers the package expects a consumer to bring. */
  peers?: readonly string[]
  /** Milliseconds the install may take. Defaults to five minutes. */
  installTimeout?: number
  /** Path of the Node binary the children run on, for checking the package on a release other than the one running the suite. Defaults to that one. */
  node?: string
}

/**
 * How one script runs inside the consumer.
 */
export type RunOptions<TArgs = undefined> = {
  /** Whether the script is an ES module (`import`, the default) or CommonJS (`require`). */
  kind?: ModuleKind
  /** A JSON value handed to the function as its only argument. */
  args?: TArgs
  /** Directory the child runs from, relative to the consumer. Defaults to the consumer itself. */
  cwd?: string
  /** Environment variables set for the child, on top of this process's. */
  env?: NodeJS.ProcessEnv
  /** Milliseconds the child may run. Defaults to two minutes. */
  timeout?: number
}

/**
 * What a child process run from the consumer reported.
 */
export type ConsumerRun = {
  /** The exit code, or null when a signal ended the child. */
  status: number | null
  /** Everything the child wrote to stdout. */
  stdout: string
  /** Everything the child wrote to stderr. */
  stderr: string
}

/**
 * One export entry loaded through plain Node.
 */
export type EntryLoad = {
  /** The specifier a consumer writes, such as `@scope/pkg/sub`. */
  specifier: string
  /** Whether the entry was loaded with `import` or `require`. */
  kind: ModuleKind
  /** Whether the load succeeded. */
  ok: boolean
  /** The first error lines when it did not, empty otherwise. */
  message: string
}

/**
 * A directory outside the workspace with a packed package installed into it, driven through
 * plain Node child processes.
 */
export type PackedConsumer = {
  /** Absolute path of the consumer directory, with symbolic links resolved. */
  readonly path: string
  /** The installed package's name, read from the manifest npm wrote. */
  readonly packageName: string
  /** Writes one file under the consumer, creating parent directories, and returns its absolute path. */
  write(relativePath: string, content: FileContent): string
  /** Writes a tree of files under the consumer. */
  writeTree(tree: FileTree): void
  /** Runs the consumer's Node binary with the given arguments, from the consumer directory, with no loader hooks. */
  node(args: readonly string[], options?: Pick<RunOptions, 'cwd' | 'env' | 'timeout'>): ConsumerRun
  /** Runs a function in a child process from the consumer directory and returns what it resolved to, carried as JSON; throws with the child's stderr when it failed. */
  run<TResult, TArgs = undefined>(fn: (args: TArgs) => TResult, options?: RunOptions<TArgs>): Awaited<TResult>
  /** Loads every `exports` entry of the installed package, one child process each; `kind` restricts to `import` or `require`, default both. */
  entries(kind?: ModuleKind): EntryLoad[]
  /** Lists every file under a directory of the consumer, as sorted paths relative to it with forward slashes. */
  listFiles(relativeDir: string): string[]
  /** Deletes the consumer directory. Removing twice is a no-op. */
  remove(): void
}

/** The slice of the consumer's manifest the package lookup reads. */
type ConsumerManifest = {
  /** What npm recorded, the tarball among them as a `file:` specifier. */
  dependencies?: Record<string, string>
}

/** The slice of the installed package's manifest the entry probe reads. */
type InstalledManifest = {
  /** The `exports` map, whose subpaths and conditions name what a consumer can load. */
  exports?: Record<string, unknown>
}

// why: the test runner marks its children with this variable, and a nested `node --test` that inherits it reports a recursive call and runs nothing while exiting 0.
const NODE_TEST_MARKER = 'NODE_TEST_CONTEXT'
// why: the runtime's own preload reads its aliases from these variables, so a child that loads the installed hooks would resolve the package back to workspace source if they leaked.
const RUNTIME_PREFIX = 'HF_TEST_'
const DEFAULT_INSTALL_TIMEOUT = 300_000
const DEFAULT_RUN_TIMEOUT = 120_000
const WORK_DIR = '.hf-consumer'
const KINDS: readonly ModuleKind[] = ['import', 'require']
const ARGS_ENV = 'HF_CONSUMER_ARGS'
const RESULT_ENV = 'HF_CONSUMER_RESULT'

/**
 * Builds the arguments npm receives, quoted where a Windows shell is in the way.
 *
 * @param args - The arguments as npm should receive them.
 * @param platform - The platform the command runs on.
 * @returns The arguments to hand `execFileSync`.
 * @example Quoting a path with a space for the Windows shell
 * ```ts
 * npmArguments(['install', 'C:\\My Packages\\lib.tgz'], 'win32')
 * // => ['install', '"C:\\My Packages\\lib.tgz"']
 * ```
 */
export function npmArguments(args: readonly string[], platform: NodeJS.Platform): string[] {
  // why: npm is a .cmd shim on Windows, which only a shell can launch, and the shell splits an unquoted argument at every space.
  return platform === 'win32' ? args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)) : [...args]
}

/**
 * Builds the environment a child inherits: this process's, minus the test runner's markers, plus the extras.
 *
 * @param extra - Variables the caller adds, overriding inherited ones of the same name.
 * @returns Variables for a child that must find the package the way a consumer does.
 */
function childEnvironment(extra: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key === NODE_TEST_MARKER || key.startsWith(RUNTIME_PREFIX)) continue
    environment[key] = value
  }
  return { ...environment, ...extra }
}

/**
 * Installs the tarball and its peers into a fresh directory.
 *
 * @param options - What to install.
 * @returns The consumer directory's resolved path.
 */
function install(options: PackedConsumerOptions): string {
  if (options.tarball === undefined || options.tarball === '') {
    throw new Error(
      'createPackedConsumer: no tarball path was given; pack the built package with `npm pack` and pass the path of the .tgz it wrote'
    )
  }
  const tarball = resolve(options.tarball)
  if (!existsSync(tarball)) {
    throw new Error(`createPackedConsumer: the tarball ${tarball} does not exist`)
  }
  const dir = createTempDir({ prefix: 'hf-consumer-', tree: { 'package.json': { name: 'consumer', version: '0.0.0', private: true } } })
  const specifiers = [tarball, ...(options.peers ?? [])]
  // why: --prefer-offline reuses whatever the npm cache already holds, which is everything a prior install of the same tarball fetched, so the consumer installs fast and offline.
  const args = ['install', '--prefer-offline', '--no-audit', '--no-fund', '--loglevel=error', ...specifiers]
  try {
    execFileSync('npm', npmArguments(args, process.platform), {
      cwd: dir.path,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      timeout: options.installTimeout ?? DEFAULT_INSTALL_TIMEOUT,
    })
  } catch (error) {
    dir.remove()
    throw error
  }
  return dir.path
}

/**
 * Reads the name npm recorded for the tarball in the consumer's manifest.
 *
 * @param root - The consumer directory.
 * @param tarball - The installed tarball's absolute path.
 * @returns The package name.
 */
function installedName(root: string, tarball: string): string {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as ConsumerManifest
  const entry = Object.entries(manifest.dependencies ?? {}).find(
    ([, spec]) => spec.startsWith('file:') && resolve(root, spec.slice('file:'.length)) === tarball
  )
  if (!entry) {
    throw new Error(`createPackedConsumer: npm did not record ${tarball} in ${join(root, 'package.json')}`)
  }
  return entry[0]
}

/**
 * The specifiers and module kinds a package's `exports` map offers.
 *
 * @param packageName - The scoped or bare name every specifier starts with.
 * @param exportsMap - The manifest's `exports` object, or undefined for a package that only has a main entry.
 * @returns One pair per subpath per supported condition.
 */
function entriesOf(packageName: string, exportsMap: Record<string, unknown> | undefined): Array<Pick<EntryLoad, 'specifier' | 'kind'>> {
  if (exportsMap === undefined) return KINDS.map((kind) => ({ specifier: packageName, kind }))
  const pairs: Array<Pick<EntryLoad, 'specifier' | 'kind'>> = []
  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (subpath === './package.json') continue
    const specifier = subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`
    const kinds = typeof target === 'string' ? KINDS : KINDS.filter((kind) => typeof (target as Record<string, unknown>)[kind] === 'string')
    for (const kind of kinds) pairs.push({ specifier, kind })
  }
  return pairs
}

/**
 * The first lines a failed child wrote to stderr, joined for a one-line report.
 *
 * @param stderr - Everything the child wrote.
 * @returns Up to three non-empty lines.
 */
function firstLines(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 3)
    .join(' | ')
}

/**
 * The source of the script that calls a serialised function and writes its result.
 *
 * @param kind - The module system of the script.
 * @param source - The function's source text.
 * @returns The script's source.
 */
function runnerSource(kind: ModuleKind, source: string): string {
  // why: the argument and result paths arrive through the environment so no value but the function's own source is spliced into the script.
  // why: the result goes to a file rather than stdout so whatever the package under test prints cannot corrupt it.
  const paths = `const { ${ARGS_ENV}: argsPath, ${RESULT_ENV}: resultPath } = process.env`
  const call = `fn(JSON.parse(readFileSync(argsPath, 'utf8')))`
  const save = `(result) => writeFileSync(resultPath, JSON.stringify(result === undefined ? null : result))`
  if (kind === 'import') {
    return `import { readFileSync, writeFileSync } from 'node:fs'\n${paths}\nconst fn = (${source})\n;(${save})(await ${call})\n`
  }
  return `'use strict'\nconst { readFileSync, writeFileSync } = require('node:fs')\n${paths}\nconst fn = (${source})\nPromise.resolve(${call}).then(${save})\n`
}

/**
 * Installs a packed tarball into a fresh directory under the system temporary directory and
 * returns a handle that drives the package through plain Node child processes.
 *
 * Nothing of the test process reaches the children: no loader hooks, no path aliases, no
 * hoisted `node_modules`. A package that only works through those fails here, the way it
 * would for a consumer. The caller removes the directory; for one a whole suite shares,
 * `usePackedConsumer` registers the hooks itself.
 *
 * @param options - The tarball, its peers, the install timeout and the Node binary for the children.
 * @returns The consumer handle.
 * @example Loading every entry of a packed package
 * ```ts
 * const consumer = createPackedConsumer({ tarball: '/tmp/my-lib-1.0.0.tgz' })
 * try {
 *   expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
 * } finally {
 *   consumer.remove()
 * }
 * ```
 */
export function createPackedConsumer(options: PackedConsumerOptions): PackedConsumer {
  const root = install(options)
  const packageName = installedName(root, resolve(options.tarball as string))
  let runs = 0

  const node = (args: readonly string[], runOptions: Pick<RunOptions, 'cwd' | 'env' | 'timeout'> = {}): ConsumerRun => {
    const result = spawnSync(options.node ?? process.execPath, [...args], {
      cwd: runOptions.cwd === undefined ? root : join(root, runOptions.cwd),
      encoding: 'utf8',
      env: childEnvironment(runOptions.env),
      timeout: runOptions.timeout ?? DEFAULT_RUN_TIMEOUT,
    })
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
  }

  const run = <TResult, TArgs = undefined>(fn: (args: TArgs) => TResult, runOptions: RunOptions<TArgs> = {}): Awaited<TResult> => {
    const kind = runOptions.kind ?? 'import'
    runs += 1
    const script = writeFile(root, join(WORK_DIR, `run-${runs}.${kind === 'import' ? 'mjs' : 'cjs'}`), '')
    const argsPath = writeFile(root, join(WORK_DIR, `args-${runs}.json`), JSON.stringify(runOptions.args ?? null))
    const resultPath = join(root, WORK_DIR, `result-${runs}.json`)
    writeFileSync(script, runnerSource(kind, fn.toString()))
    const result = node([script], { ...runOptions, env: { ...runOptions.env, [ARGS_ENV]: argsPath, [RESULT_ENV]: resultPath } })
    if (result.status !== 0) {
      throw new Error(`consumer.run: the child exited with ${result.status ?? 'a signal'}\n${result.stderr}`)
    }
    return JSON.parse(readFileSync(resultPath, 'utf8')) as Awaited<TResult>
  }

  const entries = (kind?: ModuleKind): EntryLoad[] => {
    const manifestPath = join(root, 'node_modules', ...packageName.split('/'), 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as InstalledManifest
    const scripts = {
      import: writeFile(root, join(WORK_DIR, 'load.mjs'), 'await import(process.env.HF_CONSUMER_TARGET)\n'),
      require: writeFile(root, join(WORK_DIR, 'load.cjs'), 'require(process.env.HF_CONSUMER_TARGET)\n'),
    }
    return entriesOf(packageName, manifest.exports)
      .filter((pair) => kind === undefined || pair.kind === kind)
      .map((pair) => {
        const load = node([scripts[pair.kind]], { env: { HF_CONSUMER_TARGET: pair.specifier } })
        return { ...pair, ok: load.status === 0, message: load.status === 0 ? '' : firstLines(load.stderr) }
      })
  }

  const listFiles = (relativeDir: string): string[] => {
    const base = join(root, relativeDir)
    const files: string[] = []
    const visit = (current: string): void => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, entry.name)
        if (entry.isDirectory()) visit(full)
        else files.push(relative(base, full).split(sep).join(posix.sep))
      }
    }
    if (existsSync(base)) visit(base)
    return files.sort()
  }

  return {
    path: root,
    packageName,
    write: (relativePath, content) => writeFile(root, relativePath, content),
    writeTree: (tree) => writeTree(root, tree),
    node,
    run,
    entries,
    listFiles,
    remove: () => rmSync(root, { recursive: true, force: true, maxRetries: 3 }),
  }
}

/**
 * Gives the enclosing suite one installed consumer, created before its first test and deleted
 * after its last, by registering the `node:test` hooks that do it.
 *
 * Call it in a `describe` body or at the top of a spec file. The returned handle forwards to
 * the consumer current at the time of each call, so it can be captured once and used from
 * any test or hook. Using it outside a test throws, since nothing is installed then.
 *
 * Functions handed to `run` are serialised with `toString()` and executed in the child, so
 * they can close over nothing from the spec: pass values through `args` and import the
 * package inside the body.
 *
 * @param options - The tarball, its peers, the install timeout and the Node binary for the children.
 * @returns A handle to the suite's consumer.
 * @example Calling the packed package the way a consumer does
 * ```ts
 * const consumer = usePackedConsumer({ tarball: process.env.MY_LIB_TARBALL })
 *
 * it('imports every entry under plain Node', () => {
 *   expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
 * })
 *
 * it('hashes through the node entry', () => {
 *   const hash = consumer.run(async () => {
 *     const { createHash } = await import('my-lib/node')
 *     return createHash('abc')
 *   })
 *   expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
 * })
 * ```
 */
export function usePackedConsumer(options: PackedConsumerOptions): PackedConsumer {
  let current: PackedConsumer | undefined
  const consumer = (): PackedConsumer => {
    if (current === undefined) throw new Error('usePackedConsumer: the consumer exists only while a test or hook of the suite runs')
    return current
  }
  before(
    () => {
      current = createPackedConsumer(options)
    },
    { timeout: options.installTimeout ?? DEFAULT_INSTALL_TIMEOUT }
  )
  after(() => {
    current?.remove()
    current = undefined
  })
  return {
    get path() {
      return consumer().path
    },
    get packageName() {
      return consumer().packageName
    },
    write: (relativePath, content) => consumer().write(relativePath, content),
    writeTree: (tree) => consumer().writeTree(tree),
    node: (args, runOptions) => consumer().node(args, runOptions),
    run: (fn, runOptions) => consumer().run(fn, runOptions),
    entries: (kind) => consumer().entries(kind),
    listFiles: (relativeDir) => consumer().listFiles(relativeDir),
    remove: () => consumer().remove(),
  }
}
