#!/usr/bin/env node
/**
 * Load every export entry of every built hyperfrontend package on the running
 * Node.js, each in a process of its own, and fail when any of them cannot be
 * imported or required.
 *
 * The packages declare a Node.js floor in `engines.node`, and the toolchain
 * runs on a far newer release, so nothing else notices when an entry reads a
 * global the floor does not have. Run this on the floor release after the
 * packages are built: a module that loads there keeps the declared floor true.
 *
 * A package whose own `engines.node` floor is above the running release is
 * reported and skipped rather than probed: it never claimed to load there, and
 * its entries are checked whenever the probe runs on a release it does cover.
 *
 * Written as plain JavaScript with no dependencies so it runs on the floor
 * release itself, whichever that is. Each entry is loaded by a child process
 * whose target arrives through the environment, never argv: some entries are
 * self-executing scripts that read their job from argv when they believe they
 * are the main module.
 *
 * Usage, from the workspace root after `npx nx run-many -t build`:
 *
 *   node tools/workspace/scripts/probe-node-floor.mjs
 *   npx -y -p node@18.0.0 node tools/workspace/scripts/probe-node-floor.mjs
 *   node tools/workspace/scripts/probe-node-floor.mjs --list-floors
 *
 * `--list-floors` prints the distinct `engines.node` floors the built packages declare, lowest
 * first, one per line, so a caller can run the probe once per floor. `HF_DIST` points at another
 * built tree (default `dist/libs`).
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_PATH = fileURLToPath(import.meta.url)

/** Entries that only load with extra Node flags on some releases, with the reason their docs give. */
const FLAGGED_ENTRIES = {
  '@hyperfrontend/builder/bundle/rollup/worker': {
    // why: the worker loads the terser plugin, whose bundled serialize-javascript reads the crypto global at load; hf-build passes the same flag to the worker it spawns, so a direct import mirrors that
    execArgv: () => (typeof globalThis.crypto === 'undefined' ? ['--experimental-global-webcrypto'] : []),
  },
}

const CONCURRENCY = 4

const loadTarget = async () => {
  const target = process.env.HF_PROBE_TARGET
  try {
    if (process.env.HF_PROBE_KIND === 'require') {
      createRequire(import.meta.url)(target)
    } else {
      await import(pathToFileURL(target).href)
    }
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

/**
 * Read the lowest Node.js release a package declares it loads on.
 *
 * @param range - The `engines.node` range, such as `>=22.18.0`.
 * @returns The floor as `[major, minor, patch]`, or null when the package declares none.
 */
const declaredFloor = (range) => {
  const match = /^\s*>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(typeof range === 'string' ? range : '')
  return match === null ? null : [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}

const RUNNING = process.versions.node.split('.').map(Number)

/**
 * Whether the running release sits below a declared floor.
 *
 * @param floor - A floor from `declaredFloor`, or null.
 * @returns True when the floor is declared and the running release does not reach it.
 */
const runsBelow = (floor) => {
  if (floor === null) return false
  for (let index = 0; index < 3; index++) {
    if ((RUNNING[index] ?? 0) !== floor[index]) return (RUNNING[index] ?? 0) < floor[index]
  }
  return false
}

const findPackages = (root, depth = 0) => {
  const manifest = join(root, 'package.json')
  if (existsSync(manifest)) {
    const parsed = JSON.parse(readFileSync(manifest, 'utf8'))
    if (typeof parsed.name === 'string' && parsed.name.startsWith('@hyperfrontend/')) {
      return [{ root, name: parsed.name, exports: parsed.exports ?? {}, floor: declaredFloor(parsed.engines?.node) }]
    }
  }
  if (depth >= 2) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => findPackages(join(root, entry.name), depth + 1))
}

const targetsOf = (value) => {
  if (typeof value === 'string') {
    if (value.endsWith('.mjs')) return [{ kind: 'import', file: value }]
    if (value.endsWith('.cjs')) return [{ kind: 'require', file: value }]
    return [
      { kind: 'import', file: value },
      { kind: 'require', file: value },
    ]
  }
  const targets = []
  if (typeof value.import === 'string') targets.push({ kind: 'import', file: value.import })
  if (typeof value.require === 'string') targets.push({ kind: 'require', file: value.require })
  return targets
}

const collectProbes = (packages) =>
  packages.flatMap((pkg) =>
    Object.entries(pkg.exports)
      .filter(([subpath]) => subpath !== './package.json')
      .flatMap(([subpath, value]) => {
        const specifier = subpath === '.' ? pkg.name : `${pkg.name}${subpath.slice(1)}`
        return targetsOf(value).map(({ kind, file }) => ({ specifier, kind, file: resolve(pkg.root, file) }))
      })
  )

const probeOne = (probe) =>
  new Promise((resolvePromise) => {
    const execArgv = FLAGGED_ENTRIES[probe.specifier]?.execArgv() ?? []
    const child = spawn(process.execPath, [...execArgv, SCRIPT_PATH], {
      env: { ...process.env, HF_PROBE_TARGET: probe.file, HF_PROBE_KIND: probe.kind },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => resolvePromise({ ...probe, ok: false, message: error.message }))
    child.on('exit', (code) => {
      const firstLine = stderr.split(/\r?\n/).find((line) => line.trim().length > 0) ?? `exit code ${code}`
      resolvePromise({ ...probe, ok: code === 0, message: code === 0 ? '' : firstLine, flags: execArgv })
    })
  })

const runAll = async (probes) => {
  const results = []
  let next = 0
  const worker = async () => {
    while (next < probes.length) {
      const probe = probes[next]
      next++
      results.push(await probeOne(probe))
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

/**
 * The distinct floors the built packages declare, lowest first.
 *
 * @param packages - The built packages.
 * @returns Each distinct floor as `major.minor.patch`.
 */
const distinctFloors = (packages) => {
  const floors = new Map()
  for (const pkg of packages) {
    if (pkg.floor !== null) floors.set(pkg.floor.join('.'), pkg.floor)
  }
  return [...floors.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).map((floor) => floor.join('.'))
}

const main = async () => {
  const distRoot = resolve(process.env.HF_DIST ?? join('dist', 'libs'))
  if (!existsSync(distRoot)) {
    process.stderr.write(`no built packages under ${distRoot}; build them first\n`)
    process.exit(2)
  }
  const built = findPackages(distRoot).sort((a, b) => a.name.localeCompare(b.name))
  if (process.argv.includes('--list-floors')) {
    process.stdout.write(`${distinctFloors(built).join('\n')}\n`)
    return
  }
  const skipped = built.filter((pkg) => runsBelow(pkg.floor))
  const packages = built.filter((pkg) => !runsBelow(pkg.floor))
  const probes = collectProbes(packages)
  process.stdout.write(`node ${process.version}: probing ${probes.length} entries across ${packages.length} packages under ${distRoot}\n`)
  for (const pkg of skipped) {
    process.stdout.write(`skip  ${pkg.name} declares node >=${pkg.floor.join('.')}, above ${process.version}\n`)
  }
  const results = await runAll(probes)
  const failures = results.filter((result) => !result.ok)
  for (const result of results.filter((item) => item.flags.length > 0)) {
    process.stdout.write(`flags ${result.flags.join(' ')} ${result.kind} ${result.specifier}\n`)
  }
  for (const failure of failures) {
    process.stdout.write(`FAIL  ${failure.kind} ${failure.specifier}: ${failure.message}\n`)
  }
  process.stdout.write(
    `${results.length - failures.length} of ${results.length} entries load on node ${process.version}; ${failures.length} failed\n`
  )
  process.exit(failures.length === 0 ? 0 : 1)
}

if (process.env.HF_PROBE_TARGET) {
  await loadTarget()
} else {
  await main()
}
