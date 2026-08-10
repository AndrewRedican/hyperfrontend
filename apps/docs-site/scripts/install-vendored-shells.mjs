#!/usr/bin/env node
/**
 * Installs every vendored demo shell tarball by explicit path.
 *
 * A bare `npm install` does not re-resolve a `file:` specifier whose path has
 * not changed. When a shell is repacked at the same version — which is the
 * normal case while a demo is being iterated on — npm reports "up to date",
 * leaves the stale integrity in `package-lock.json`, and installs the previous
 * contents from cache. On a cold cache the same drift fails hard with
 * EINTEGRITY instead, which is how it usually surfaces in CI.
 *
 * Installing by explicit path is the only invocation that recomputes the hash,
 * rewrites the manifest, and installs what was actually packed. It also picks
 * up a version bump without anyone hand-editing the dependency string.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR_DIR = join(SITE_ROOT, 'vendor')

if (!existsSync(VENDOR_DIR)) {
  process.stderr.write(`No vendor directory at ${VENDOR_DIR}\n`)
  process.exit(1)
}

const tarballs = readdirSync(VENDOR_DIR).filter((name) => name.endsWith('.tgz'))
if (tarballs.length === 0) {
  process.stderr.write(`No vendored shell tarballs in ${VENDOR_DIR}\n`)
  process.exit(1)
}

// why: The leading `./` is load-bearing — npm reads a bare `vendor/x.tgz` as a git shorthand and tries to clone it from GitHub.
// why: One install call for all of them keeps the lockfile resolution consistent; installing them one at a time rewrites the tree once per shell.
execFileSync('npm', ['install', ...tarballs.map((name) => `./${join('vendor', name)}`), '--no-audit', '--no-fund'], {
  cwd: SITE_ROOT,
  stdio: 'inherit',
})

process.stdout.write(`Installed ${tarballs.length} vendored shell tarball(s)\n`)
