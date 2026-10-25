/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/builder`.
 *
 * The first suite imports the installed package from this test process. The second installs the packed
 * tarball into a directory outside the workspace and drives it through plain Node child processes with
 * no loader hooks, path aliases or hoisted `node_modules`: every entry is imported natively, a two-entry
 * library is built with it, and the built ES modules, the browser bundles and the declarations are
 * exercised the way a consumer's tooling would.
 */

import type { ConsumerRun, NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'
import { PROBE_LIBRARY_COUNTS, PROBE_LIBRARY_FILES, PROBE_LIBRARY_OUT, buildProbeLibrary, jsonOf } from './support/probe-library'

const PACKAGE = '@hyperfrontend/builder'
const E2E_DIR = join(import.meta.dirname, '..')
// why: a tarball install, a bundled build with a declaration pass and a consumer typecheck run back to back in the setup.
const SETUP_TIMEOUT = 600_000

describe('@hyperfrontend/builder ESM', () => {
  it('is importable', async () => {
    const pkg = await import('@hyperfrontend/builder')
    expect(pkg).toBeDefined()
  })

  it('exposes the documented public API', async () => {
    const pkg = await import('@hyperfrontend/builder')
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
    ] as const
    for (const name of expected) {
      expect(typeof pkg[name]).toBe('function')
    }
  })

  it('resolves the /presets subpath export with byNames and byPrefix functions', async () => {
    const { byNames, byPrefix } = await import('@hyperfrontend/builder/presets')
    expect({ byNames, byPrefix }).toEqual({ byNames: expect.any(Function), byPrefix: expect.any(Function) })
  })

  it('builds a byNames predicate from the /presets subpath that accepts a listed name', async () => {
    const { byNames } = await import('@hyperfrontend/builder/presets')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('internal-utils')).toBe(true)
  })

  it('builds a byNames predicate from the /presets subpath that rejects an unlisted name', async () => {
    const { byNames } = await import('@hyperfrontend/builder/presets')
    const isNamed = byNames(['internal-utils'])
    expect(isNamed('rollup')).toBe(false)
  })

  it('builds a byPrefix predicate from the /presets subpath that accepts a name under the prefix', async () => {
    const { byPrefix } = await import('@hyperfrontend/builder/presets')
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('@hyperfrontend/logging')).toBe(true)
  })

  it('builds a byPrefix predicate from the /presets subpath that rejects a name outside the prefix', async () => {
    const { byPrefix } = await import('@hyperfrontend/builder/presets')
    const isScoped = byPrefix('@hyperfrontend/')
    expect(isScoped('rollup')).toBe(false)
  })
})

const RUNNERS: Record<string, string> = {
  'presets.mjs': [
    "import { byNames, byPrefix } from '@hyperfrontend/builder/presets'",
    "const named = byNames(['internal-utils'])",
    "const scoped = byPrefix('@hyperfrontend/')",
    "process.stdout.write(JSON.stringify({ named: named('internal-utils'), unnamed: named('rollup'), scoped: scoped('@hyperfrontend/logging'), unscoped: scoped('rollup') }))",
    '',
  ].join('\n'),
  'run-esm.mjs': [
    `import { VERSION, greet, merge } from './${PROBE_LIBRARY_OUT}/index.mjs'`,
    `import { shout } from './${PROBE_LIBRARY_OUT}/extra/index.mjs'`,
    "process.stdout.write(JSON.stringify({ merged: merge({ a: 1 }, { b: 2 }), greeting: greet('x'), shouted: shout('y'), VERSION }))",
    '',
  ].join('\n'),
  'run-bundles.cjs': [
    "const { readFileSync } = require('node:fs')",
    "const { runInNewContext } = require('node:vm')",
    'const iife = {}',
    `runInNewContext(readFileSync('${PROBE_LIBRARY_OUT}/bundle/index.iife.min.js', 'utf8'), iife)`,
    'const umd = { exports: {} }',
    `runInNewContext(readFileSync('${PROBE_LIBRARY_OUT}/bundle/index.umd.min.js', 'utf8'), { module: umd, exports: umd.exports })`,
    'process.stdout.write(JSON.stringify({ iife: Object.keys(iife.Probe).sort(), iifeMerge: iife.Probe.merge({ a: 1 }, { b: 2 }), umd: Object.keys(umd.exports).sort() }))',
    '',
  ].join('\n'),
  'typecheck/consumer.ts': [
    "import { greet, merge } from 'probe-lib'",
    "import { shout } from 'probe-lib/extra'",
    "const merged: { a: number; b: string } = merge({ a: 1 }, { b: 'x' })",
    "const shouted: string = shout(greet('z'))",
    'export { merged, shouted }',
    '',
  ].join('\n'),
  'typecheck/tsconfig.json': `${JSON.stringify(
    {
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
        baseUrl: '.',
        paths: { 'probe-lib': [`../${PROBE_LIBRARY_OUT}/index.d.ts`], 'probe-lib/extra': [`../${PROBE_LIBRARY_OUT}/extra/index.d.ts`] },
      },
      files: ['consumer.ts'],
    },
    null,
    2
  )}\n`,
}

describe('@hyperfrontend/builder ESM under plain Node in an isolated consumer', () => {
  let consumer: NativeConsumer
  let buildRun: ConsumerRun

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      for (const [relativePath, content] of Object.entries(RUNNERS)) consumer.write(relativePath, content)
      buildRun = buildProbeLibrary(consumer)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('imports every export entry natively', () => {
    const loads = consumer.loadEntries('import')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('declares the documented Node.js floor', () => {
    const manifest = JSON.parse(consumer.node(['-p', `JSON.stringify(require('${PACKAGE}/package.json').engines)`]).stdout) as {
      node: string
    }
    expect(manifest.node).toBe('>=18.0.0')
  })

  it('classifies package names through the presets entry', () => {
    expect(jsonOf(consumer.node([join(consumer.path, 'presets.mjs')]))).toEqual({
      named: true,
      unnamed: false,
      scoped: true,
      unscoped: false,
    })
  })

  it('builds a two-entry library with bundled deps and minified browser bundles', () => {
    expect({ status: buildRun.status, counts: buildRun.status === 0 ? JSON.parse(buildRun.stdout) : buildRun.stderr }).toEqual({
      status: 0,
      counts: PROBE_LIBRARY_COUNTS,
    })
  })

  it('emits every entry in every format with the bundled dep and the shared chunk beside them', () => {
    expect(consumer.listFiles(PROBE_LIBRARY_OUT)).toEqual(expect.arrayContaining(PROBE_LIBRARY_FILES))
  })

  it('runs the built ES modules through the bundled dep and the shared chunk', () => {
    expect(jsonOf(consumer.node([join(consumer.path, 'run-esm.mjs')]))).toEqual({
      merged: { a: 1, b: 2 },
      greeting: 'hello x',
      shouted: 'HELLO Y',
      VERSION: '1.0.0',
    })
  })

  it('builds the browser bundles from the root entry when the bundle configs omit entry', () => {
    expect(jsonOf(consumer.node([join(consumer.path, 'run-bundles.cjs')]))).toEqual({
      iife: ['VERSION', 'greet', 'merge'],
      iifeMerge: { a: 1, b: 2 },
      umd: ['VERSION', 'greet', 'merge'],
    })
  })

  it('emits declarations a strict NodeNext consumer compiles without skipLibCheck', () => {
    const tsc = join(consumer.path, 'node_modules', 'typescript', 'bin', 'tsc')
    const run = consumer.node([tsc, '-p', join(consumer.path, 'typecheck')])
    expect({ status: run.status, output: run.stdout.trim() }).toEqual({ status: 0, output: '' })
  })
})
