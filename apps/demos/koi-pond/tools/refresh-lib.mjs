#!/usr/bin/env node
/**
 * Rebuilds the shared koi lib, repacks it into the pond's one vendor directory,
 * and reinstalls it into every project that consumes it.
 *
 * The load-bearing detail is `npm install <path>`. A bare `npm install` does not
 * re-resolve a `file:` specifier whose path has not changed: with a warm cache it
 * reports "up to date", leaves the stale integrity in the lockfile, and installs
 * the previous contents. On a cold cache the same drift fails hard with
 * EINTEGRITY instead. Installing by explicit path is the only invocation that
 * recomputes the hash, rewrites the manifest, and installs what was actually
 * packed.
 *
 * Run with `--check` to assert the committed tarball and every consumer lock
 * still match a fresh build, which is what turns that silent staleness into a
 * loud failure.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const POND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIB_DIR = join(POND_ROOT, 'lib')
const VENDOR_DIR = join(POND_ROOT, 'vendor')
const LIB_PACKAGE = '@hyperfrontend/demo-koi-lib'
const TARBALL_PREFIX = 'hyperfrontend-demo-koi-lib-'

/** Every project that takes the koi lib as a `file:` dependency, in refresh order. */
const CONSUMERS = ['host', 'fish-vanilla', 'fish-react', 'fish-vue', 'fish-svelte', 'fish-solid', 'fish-preact', 'fish-lit', 'fish-angular']

/**
 * Lists the koi-lib tarballs sitting in the shared vendor directory.
 *
 * @param {string} dir - Directory to scan.
 * @returns {string[]} The matching tarball file names.
 */
function listTarballs(dir) {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir).filter((name) => name.startsWith(TARBALL_PREFIX) && name.endsWith('.tgz'))
}

/**
 * Computes the integrity string npm records for a tarball.
 *
 * @param {string} file - Absolute path to the tarball.
 * @returns {string} The `sha512-<base64>` integrity string.
 */
function integrityOf(file) {
  return `sha512-${createHash('sha512').update(readFileSync(file)).digest('base64')}`
}

/**
 * Builds the lib and packs it into a directory.
 *
 * @param {string} dir - Destination directory for the tarball.
 * @returns {string} The packed tarball's file name.
 */
function packInto(dir) {
  // why: npm pack fails with ENOENT rather than creating a missing destination.
  mkdirSync(dir, { recursive: true })
  // why: tsc leaves the output of a deleted source file behind, and npm pack ships whatever is in the directory; building from empty is what keeps a retired module out of the tarball and makes a local check match a clean checkout's.
  rmSync(join(LIB_DIR, 'dist'), { recursive: true, force: true })
  execFileSync('npm', ['run', 'build'], { cwd: LIB_DIR, stdio: 'inherit' })
  // why: Packing outside the package directory keeps the previous tarball from being swept into the next one.
  const output = execFileSync('npm', ['pack', '--pack-destination', dir], { cwd: LIB_DIR, encoding: 'utf-8' })
  return output.trim().split('\n').pop()
}

/**
 * Lists the consumers that actually exist on disk.
 *
 * @returns {string[]} Consumer directory names, in refresh order.
 */
function presentConsumers() {
  // why: The pond is built up one project at a time; refreshing must work from the first consumer through to all eight.
  return CONSUMERS.filter((consumer) => existsSync(join(POND_ROOT, consumer, 'package.json')))
}

/**
 * Reads a consumer's recorded integrity for the koi lib.
 *
 * @param {string} consumer - Consumer directory name under the pond root.
 * @returns {string | null} The integrity string, or null when the consumer has no entry.
 */
function lockedIntegrity(consumer) {
  const lockPath = join(POND_ROOT, consumer, 'package-lock.json')
  if (!existsSync(lockPath)) {
    return null
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf-8'))
  return lock.packages?.[`node_modules/${LIB_PACKAGE}`]?.integrity ?? null
}

/**
 * Regenerates the tarball and re-points every consumer at it.
 */
function refresh() {
  // why: The vendor directory holds exactly one tarball; pruning first stops superseded versions accumulating in git history.
  for (const stale of listTarballs(VENDOR_DIR)) {
    rmSync(join(VENDOR_DIR, stale))
  }
  const tarball = packInto(VENDOR_DIR)
  const consumers = presentConsumers()
  for (const consumer of consumers) {
    execFileSync('npm', ['install', join('..', 'vendor', tarball), '--no-audit', '--no-fund'], {
      cwd: join(POND_ROOT, consumer),
      stdio: 'inherit',
    })
  }
  process.stdout.write(`Packed ${tarball} and refreshed ${consumers.length} consumer(s)\n`)
}

/**
 * Fails when the committed tarball is stale or a consumer lock has drifted.
 */
function check() {
  const vendored = listTarballs(VENDOR_DIR)
  const failures = []
  const temp = mkdtempSync(join(tmpdir(), 'koi-lib-'))
  try {
    const fresh = packInto(temp)
    const freshIntegrity = integrityOf(join(temp, fresh))
    if (vendored.length !== 1) {
      failures.push(`expected exactly one vendored tarball, found ${vendored.length}`)
    } else if (vendored[0] !== fresh) {
      failures.push(`vendored ${vendored[0]} but the lib now packs as ${fresh}`)
    } else if (integrityOf(join(VENDOR_DIR, vendored[0])) !== freshIntegrity) {
      failures.push(`vendored ${vendored[0]} does not match a fresh pack`)
    }
    for (const consumer of presentConsumers()) {
      if (lockedIntegrity(consumer) !== freshIntegrity) {
        failures.push(`${consumer}: package-lock.json integrity is stale`)
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
  if (failures.length > 0) {
    process.stderr.write(`${failures.join('\n')}\nRun: npx nx run demo-koi-lib:refresh\n`)
    process.exit(1)
  }
  process.stdout.write('Koi lib tarball and consumer locks are in sync\n')
}

if (process.argv.includes('--check')) {
  check()
} else {
  refresh()
}
