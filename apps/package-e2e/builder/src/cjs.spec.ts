/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/builder`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * loader hooks: every entry is required natively, the `hf-build` bin is run as installed, and a library built with
 * the installed builder runs as CommonJS.
 */

'use strict'

const { readFileSync, statSync } = require('node:fs')
const { join } = require('node:path')
const { before } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')
const { PROBE_LIBRARY_COUNTS, PROBE_LIBRARY_OUT, buildProbeLibrary, buildReport } = require('./support/probe-library')

// why: a bundled build runs in the setup, after the install.
const BUILD_TIMEOUT = 600_000

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })
let built
let manifest
let binPath

before(
  () => {
    const packageDir = join(consumer.path, 'node_modules', '@hyperfrontend', 'builder')
    manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
    binPath = join(packageDir, manifest.bin['hf-build'])
    built = buildProbeLibrary(consumer)
  },
  { timeout: BUILD_TIMEOUT }
)

describe('@hyperfrontend/builder CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented public API', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/builder')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        build: 'function',
        createBuildContext: 'function',
        runBinPhase: 'function',
        runBundlePhase: 'function',
        runPackagePhase: 'function',
        createMemoryMonitor: 'function',
        recover: 'function',
        byNames: 'function',
        byPrefix: 'function',
      })
    )
  })

  it('classifies package names through the presets entry', () => {
    const verdicts = consumer.run(
      async () => {
        const { byNames, byPrefix } = require('@hyperfrontend/builder/presets')
        const named = byNames(['internal-utils'])
        const scoped = byPrefix('@hyperfrontend/')
        return {
          named: named('internal-utils'),
          unnamed: named('rollup'),
          scoped: scoped('@hyperfrontend/logging'),
          unscoped: scoped('rollup'),
        }
      },
      { kind: 'require' }
    )
    expect(verdicts).toEqual({ named: true, unnamed: false, scoped: true, unscoped: false })
  })

  describe('the hf-build bin', () => {
    it('is declared as a path string in the manifest', () => {
      expect(typeof manifest.bin['hf-build']).toBe('string')
    })

    it('is listed in the published files allowlist', () => {
      expect(manifest.files).toContain(manifest.bin['hf-build'].replace(/^\.\//, ''))
    })

    it('ships with the `#!/usr/bin/env node` shebang', () => {
      expect(readFileSync(binPath, 'utf8').split(/\r?\n/, 1)[0]).toBe('#!/usr/bin/env node')
    })

    it('ships with the executable bit set after extraction', () => {
      // why: 0o111 is any execute bit; npm preserves the tar mode on install.
      expect(statSync(binPath).mode & 0o111).not.toBe(0)
    })

    it('prints its usage and exits 0 on --help', () => {
      const run = consumer.node([binPath, '--help'])
      expect({ status: run.status, usage: run.stdout.includes('Usage: hf-build') }).toEqual({ status: 0, usage: true })
    })
  })

  it('builds a two-entry library with bundled deps and minified browser bundles', () => {
    expect(buildReport(built)).toEqual({ status: 0, counts: PROBE_LIBRARY_COUNTS })
  })

  it('runs the built CommonJS modules through the bundled dep and the shared chunk', () => {
    const outputs = consumer.run(
      async (args) => {
        const { VERSION, greet, merge } = require(args.root)
        const { shout } = require(args.extra)
        return { merged: merge({ a: 1 }, { b: 2 }), greeting: greet('x'), shouted: shout('y'), VERSION }
      },
      {
        kind: 'require',
        args: {
          root: join(consumer.path, PROBE_LIBRARY_OUT, 'index.cjs'),
          extra: join(consumer.path, PROBE_LIBRARY_OUT, 'extra', 'index.cjs'),
        },
      }
    )
    expect(outputs).toEqual({ merged: { a: 1, b: 2 }, greeting: 'hello x', shouted: 'HELLO Y', VERSION: '1.0.0' })
  })
})
