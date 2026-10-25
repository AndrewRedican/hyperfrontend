/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/builder`
 * Tests that the package is requireable, its subpaths resolve, and the bin is wired, from this test
 * process; then, from a packed-tarball install outside the workspace driven through plain Node child
 * processes with no loader hooks, that every entry requires natively and a library built with the
 * installed builder runs as CommonJS.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')
const { PROBE_LIBRARY_COUNTS, PROBE_LIBRARY_OUT, buildProbeLibrary, jsonOf } = require('./support/probe-library')

const PACKAGE = '@hyperfrontend/builder'
const E2E_DIR = join(__dirname, '..')
// why: a tarball install and a bundled build run back to back in the setup.
const SETUP_TIMEOUT = 600_000

describe('@hyperfrontend/builder CJS', () => {
  it('is requireable', () => {
    const pkg = require('@hyperfrontend/builder')
    expect(pkg).toBeDefined()
  })

  it('exposes the documented public API', () => {
    const pkg = require('@hyperfrontend/builder')
    const expected = [
      'build',
      'createBuildContext',
      'runBinPhase',
      'runBundlePhase',
      'runPackagePhase',
      'createMemoryMonitor',
      'recover',
      'byNames',
      'byPrefix',
    ]
    for (const name of expected) {
      expect(typeof pkg[name]).toBe('function')
    }
  })

  it('resolves the /presets subpath export with byNames and byPrefix functions', () => {
    const { byNames, byPrefix } = require('@hyperfrontend/builder/presets')
    expect({ byNames, byPrefix }).toEqual({ byNames: expect.any(Function), byPrefix: expect.any(Function) })
  })

  it('builds a byNames predicate from the /presets subpath that accepts a listed name', () => {
    const { byNames } = require('@hyperfrontend/builder/presets')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('internal-utils')).toBe(true)
  })

  it('builds a byNames predicate from the /presets subpath that rejects an unlisted name', () => {
    const { byNames } = require('@hyperfrontend/builder/presets')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('rollup')).toBe(false)
  })

  it('builds a byPrefix predicate from the /presets subpath that accepts a name under the prefix', () => {
    const { byPrefix } = require('@hyperfrontend/builder/presets')
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('@hyperfrontend/logging')).toBe(true)
  })

  it('builds a byPrefix predicate from the /presets subpath that rejects a name outside the prefix', () => {
    const { byPrefix } = require('@hyperfrontend/builder/presets')
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('rollup')).toBe(false)
  })

  it('declares the hf-build bin as a path string in its package.json', () => {
    const pkg = require('@hyperfrontend/builder/package.json')
    const binRelative = pkg.bin['hf-build']
    expect(typeof binRelative).toBe('string')
  })

  it('exposes a runnable hf-build bin (`--help` exits 0)', () => {
    const { execFileSync } = require('node:child_process')
    const { dirname, join } = require('node:path')
    const pkg = require('@hyperfrontend/builder/package.json')
    const binRelative = pkg.bin['hf-build']
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, binRelative)
    // execFileSync throws on a non-zero exit code, so a clean return asserts exit 0.
    const output = execFileSync('node', [binPath, '--help'], { encoding: 'utf8' })
    expect(output).toContain('Usage: hf-build')
  })

  it('ships the bin with the `#!/usr/bin/env node` shebang', () => {
    const { readFileSync } = require('node:fs')
    const { dirname, join } = require('node:path')
    const pkg = require('@hyperfrontend/builder/package.json')
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, pkg.bin['hf-build'])
    const firstLine = readFileSync(binPath, 'utf8').split(/\r?\n/, 1)[0]
    expect(firstLine).toBe('#!/usr/bin/env node')
  })

  it('ships the bin with the executable bit set after extraction', () => {
    const { statSync } = require('node:fs')
    const { dirname, join } = require('node:path')
    const pkg = require('@hyperfrontend/builder/package.json')
    const packageDir = dirname(require.resolve('@hyperfrontend/builder/package.json'))
    const binPath = join(packageDir, pkg.bin['hf-build'])
    // 0o111 = any execute bit (owner/group/other); npm preserves tar mode on install.
    expect(statSync(binPath).mode & 0o111).not.toBe(0)
  })

  it('includes the bin file in the published `files` allowlist', () => {
    const pkg = require('@hyperfrontend/builder/package.json')
    const binRelative = pkg.bin['hf-build'].replace(/^\.\//, '')
    expect(pkg.files).toContain(binRelative)
  })
})

describe('@hyperfrontend/builder CJS under plain Node in an isolated consumer', () => {
  let consumer
  let buildRun

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write(
        'run-cjs.cjs',
        [
          `const { VERSION, greet, merge } = require('./${PROBE_LIBRARY_OUT}/index.cjs')`,
          `const { shout } = require('./${PROBE_LIBRARY_OUT}/extra/index.cjs')`,
          "process.stdout.write(JSON.stringify({ merged: merge({ a: 1 }, { b: 2 }), greeting: greet('x'), shouted: shout('y'), VERSION }))",
          '',
        ].join('\n')
      )
      buildRun = buildProbeLibrary(consumer)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('requires every export entry natively', () => {
    const loads = consumer.loadEntries('require')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('builds a two-entry library with bundled deps and minified browser bundles', () => {
    expect({ status: buildRun.status, counts: buildRun.status === 0 ? JSON.parse(buildRun.stdout) : buildRun.stderr }).toEqual({
      status: 0,
      counts: PROBE_LIBRARY_COUNTS,
    })
  })

  it('runs the built CommonJS modules through the bundled dep and the shared chunk', () => {
    expect(jsonOf(consumer.node([join(consumer.path, 'run-cjs.cjs')]))).toEqual({
      merged: { a: 1, b: 2 },
      greeting: 'hello x',
      shouted: 'HELLO Y',
      VERSION: '1.0.0',
    })
  })
})
