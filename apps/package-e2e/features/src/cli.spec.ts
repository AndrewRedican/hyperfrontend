/**
 * Packed-tarball CLI E2E tests for the @hyperfrontend/features `hf` bin.
 * Drives the installed bin the way a consumer does: `hf --help`, a real
 * `hf dev` server held open until SIGINT, and a real `hf build` producing a
 * self-contained connector tarball.
 */

import type { ChildProcess } from 'node:child_process'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { get } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

// note: 90s covers the dev-server flow (spawn, poll past 3s, SIGINT, teardown) with slack for slow CI hosts.
const DEV_SUITE_TIMEOUT = 90000

// note: 10 minutes: `hf build` runs a real rollup bundle plus a tsc declaration pass over the installed SDK.
const BUILD_SUITE_TIMEOUT = 600000

/**
 * Resolves the absolute path of the installed `hf` bin from the packed tarball.
 *
 * @returns The absolute bin path.
 */
function resolveHfBin(): string {
  const pkg = require('@hyperfrontend/features/package.json')
  const packageDir = dirname(require.resolve('@hyperfrontend/features/package.json'))
  return join(packageDir, <string>pkg.bin['hf'])
}

/**
 * Fetches a URL and resolves with its status code and body, or rejects on a connection error.
 *
 * @param url - The URL to fetch.
 * @returns The response status code and body text.
 */
function fetchUrl(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      let body = ''
      response.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8')
      })
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }))
    })
    request.on('error', reject)
  })
}

/**
 * Resolves after the given delay.
 *
 * @param ms - Milliseconds to wait.
 * @returns A promise resolved after the delay.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Polls a URL until it responds or the deadline passes.
 *
 * @param url - The URL to poll.
 * @param timeoutMs - How long to keep trying.
 * @returns The first successful response.
 */
async function waitForUrl(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = new Error(`No response from ${url}`)
  while (Date.now() < deadline) {
    try {
      return await fetchUrl(url)
    } catch (error) {
      lastError = error
      await delay(150)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * Waits for the child's collected output to satisfy a predicate.
 *
 * @param getOutput - Reads the output collected so far.
 * @param predicate - The condition the output must satisfy.
 * @param timeoutMs - How long to keep waiting.
 * @returns The output once the predicate holds.
 */
async function waitForOutput(getOutput: () => string, predicate: (output: string) => boolean, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate(getOutput())) {
      return getOutput()
    }
    await delay(100)
  }
  throw new Error(`Timed out waiting for CLI output. Collected so far:\n${getOutput()}`)
}

/**
 * Waits for a spawned child to exit and resolves with its exit code.
 *
 * @param child - The running child process.
 * @returns The exit code, or `null` when killed by a signal.
 */
function waitForExit(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    child.once('exit', (code) => resolve(code))
  })
}

/**
 * Recursively lists every file under a directory as relative paths.
 *
 * @param dir - The directory to walk.
 * @returns Relative paths of all contained files.
 */
function listFilesRecursively(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath.slice(dir.length + 1) || '', entry.name))
}

describe('@hyperfrontend/features hf CLI', () => {
  const hfBin = resolveHfBin()

  describe('hf --help', () => {
    it('exits 0 and prints usage', () => {
      // how: execFileSync throws on a non-zero exit code, so a clean return asserts exit 0.
      const output = execFileSync('node', [hfBin, '--help'], { encoding: 'utf8' })
      expect(output).toContain('Usage: hf <command>')
    })
  })

  describe('hf dev', () => {
    let scratchDir: string
    let child: ChildProcess | undefined
    let appUrl = ''
    let firstResponse: { status: number; body: string } | undefined
    let aliveAfterThreeSeconds: { running: boolean; status: number } | undefined
    let exitCode: number | null = null

    beforeAll(async () => {
      scratchDir = mkdtempSync(join(tmpdir(), 'hf-dev-e2e-'))
      mkdirSync(join(scratchDir, 'app'))
      writeFileSync(join(scratchDir, 'app', 'index.html'), '<!doctype html><html><body>dummy-app-ok</body></html>\n')
      // note: Randomized high ports keep parallel CI jobs from colliding on a fixed port.
      const appPort = 42000 + Math.floor(Math.random() * 10000)
      const debugPort = appPort + 10000
      writeFileSync(
        join(scratchDir, 'hf-dev.config.json'),
        `${JSON.stringify({ apps: [{ name: 'dummy-app', outputDir: './app', port: appPort }] }, null, 2)}\n`
      )

      child = spawn('node', [hfBin, 'dev', '--port', String(debugPort)], {
        cwd: scratchDir,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let output = ''
      child.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8')
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8')
      })

      await waitForOutput(
        () => output,
        (collected) => collected.includes('dummy-app → ') && collected.includes('Debug UI: '),
        30000
      )
      const match = output.match(/dummy-app → (\S+)/)
      appUrl = match ? match[1] : ''
      firstResponse = await waitForUrl(appUrl, 10000)

      // why: The regression being pinned is the dev command exiting right after startup; the server must still answer past the three-second mark.
      await delay(3200)
      const probe = await fetchUrl(appUrl)
      aliveAfterThreeSeconds = { running: child.exitCode === null, status: probe.status }

      const exitPromise = waitForExit(child)
      child.kill('SIGINT')
      exitCode = await exitPromise
    }, DEV_SUITE_TIMEOUT)

    afterAll(() => {
      if (child !== undefined && child.exitCode === null) {
        child.kill('SIGKILL')
      }
      rmSync(scratchDir, { recursive: true, force: true })
    })

    it('prints the running app URL', () => {
      expect(appUrl).toMatch(/^http:\/\/localhost:\d+\/$/)
    })

    it('serves the app directory over HTTP', () => {
      expect(firstResponse).toEqual(expect.objectContaining({ status: 200, body: expect.stringContaining('dummy-app-ok') }))
    })

    it('stays alive and keeps serving past three seconds', () => {
      expect(aliveAfterThreeSeconds).toEqual({ running: true, status: 200 })
    })

    it('exits cleanly on SIGINT', () => {
      expect(exitCode).toBe(0)
    })
  })

  describe('hf build', () => {
    let scratchDir: string
    let outDir: string
    let result: { status: number | null; stderr: string; stdout: string } | undefined
    let outFiles: string[] = []

    beforeAll(() => {
      scratchDir = mkdtempSync(join(tmpdir(), 'hf-build-e2e-'))
      outDir = join(scratchDir, 'out')
      // why: The builder resolves the SDK and the tsc binary from the consumer's node_modules; linking this e2e project's install makes the scratch dir a real consumer of the packed tarball.
      symlinkSync(join(__dirname, '..', 'node_modules'), join(scratchDir, 'node_modules'), 'dir')
      writeFileSync(
        join(scratchDir, 'feature.config.json'),
        `${JSON.stringify({ name: 'e2e-widget', version: '0.0.1', contract: './widget.contract.ts', url: 'http://localhost:4300/' }, null, 2)}\n`
      )
      writeFileSync(
        join(scratchDir, 'widget.contract.ts'),
        `const contract = {
  emitted: [
    {
      type: 'tick',
      description: 'Time snapshot the feature streams to its host.',
      schema: { type: 'object', properties: { epochMs: { type: 'number' } }, required: ['epochMs'] },
    },
  ],
  accepted: [{ type: 'ping', description: 'Liveness probe the host sends to the feature.' }],
}

export default contract
`
      )

      const spawned = spawnSync('node', [hfBin, 'build', '--protocol', 'v1', '--out', outDir], {
        cwd: scratchDir,
        encoding: 'utf8',
        timeout: BUILD_SUITE_TIMEOUT - 30000,
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
      })
      result = { status: spawned.status, stderr: spawned.stderr ?? '', stdout: spawned.stdout ?? '' }
      if (spawned.status === 0) {
        outFiles = listFilesRecursively(outDir)
      }
    }, BUILD_SUITE_TIMEOUT)

    afterAll(() => {
      rmSync(scratchDir, { recursive: true, force: true })
    })

    it('exits 0', () => {
      expect(result).toEqual(expect.objectContaining({ status: 0 }))
    })

    it('emits compiled JavaScript into the out directory', () => {
      expect(outFiles).toEqual(expect.arrayContaining([expect.stringMatching(/\.js$/)]))
    })

    it('emits TypeScript declarations into the out directory', () => {
      expect(outFiles).toEqual(expect.arrayContaining([expect.stringMatching(/\.d\.ts$/)]))
    })

    it('packs the connector into a tarball', () => {
      expect(outFiles).toEqual(expect.arrayContaining([expect.stringMatching(/\.tgz$/)]))
    })

    it('emits JavaScript free of raw `import type` statements', () => {
      const withImportType = outFiles
        .filter((file) => file.endsWith('.js'))
        .filter((file) => readFileSync(join(outDir, file), 'utf8').includes('import type'))
      expect(withImportType).toEqual([])
    })
  })
})
