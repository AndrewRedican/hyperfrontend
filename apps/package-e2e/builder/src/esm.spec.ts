/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/builder`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * loader hooks: every entry is imported natively, a two-entry library is built with the installed builder, and the
 * built ES modules, the browser bundles and the declarations are exercised the way a consumer's tooling would.
 */

import type { ConsumerRun } from '@hyperfrontend/testing/consumer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'
import { PROBE_LIBRARY_COUNTS, PROBE_LIBRARY_FILES, PROBE_LIBRARY_OUT, buildProbeLibrary, buildReport } from './support/probe-library'

// why: a bundled build with a declaration pass runs in the setup, after the install.
const BUILD_TIMEOUT = 600_000

/** A consumer of the built library, type-checked by the installed TypeScript under strict NodeNext resolution. */
const TYPECHECK_PROJECT = {
  'typecheck/consumer.ts': [
    "import { greet, merge } from 'probe-lib'",
    "import { shout } from 'probe-lib/extra'",
    "const merged: { a: number; b: string } = merge({ a: 1 }, { b: 'x' })",
    "const shouted: string = shout(greet('z'))",
    'export { merged, shouted }',
    '',
  ].join('\n'),
  'typecheck/tsconfig.json': {
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
}

/** The built root and extra entry files a child loads. */
interface BuiltModules {
  /** The root entry's absolute path. */
  root: string
  /** The extra entry's absolute path. */
  extra: string
}

/** The minified browser bundles a child evaluates. */
interface BuiltBundles {
  /** The IIFE bundle's absolute path. */
  iife: string
  /** The UMD bundle's absolute path. */
  umd: string
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })
let built: ConsumerRun

before(
  () => {
    consumer.writeTree(TYPECHECK_PROJECT)
    built = buildProbeLibrary(consumer)
  },
  { timeout: BUILD_TIMEOUT }
)

describe('@hyperfrontend/builder ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented public API', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/builder')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
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

  it('declares the documented Node.js floor', () => {
    const manifest = JSON.parse(readFileSync(join(consumer.path, 'node_modules', '@hyperfrontend', 'builder', 'package.json'), 'utf8')) as {
      engines: { node: string }
    }
    expect(manifest.engines.node).toBe('>=18.0.0')
  })

  it('classifies package names through the presets entry', () => {
    const verdicts = consumer.run(async () => {
      const { byNames, byPrefix } = await import('@hyperfrontend/builder/presets')
      const named = byNames(['internal-utils'])
      const scoped = byPrefix('@hyperfrontend/')
      return {
        named: named('internal-utils'),
        unnamed: named('rollup'),
        scoped: scoped('@hyperfrontend/logging'),
        unscoped: scoped('rollup'),
      }
    })
    expect(verdicts).toEqual({ named: true, unnamed: false, scoped: true, unscoped: false })
  })

  it('builds a two-entry library with bundled deps and minified browser bundles', () => {
    expect(buildReport(built)).toEqual({ status: 0, counts: PROBE_LIBRARY_COUNTS })
  })

  it('emits every entry in every format with the bundled dep and the shared chunk beside them', () => {
    expect(consumer.listFiles(PROBE_LIBRARY_OUT)).toEqual(expect.arrayContaining(PROBE_LIBRARY_FILES))
  })

  it('runs the built ES modules through the bundled dep and the shared chunk', () => {
    const outputs = consumer.run(
      async (args: BuiltModules) => {
        const { pathToFileURL: toUrl } = await import('node:url')
        const { VERSION, greet, merge } = await import(toUrl(args.root).href)
        const { shout } = await import(toUrl(args.extra).href)
        return { merged: merge({ a: 1 }, { b: 2 }), greeting: greet('x'), shouted: shout('y'), VERSION }
      },
      {
        args: {
          root: join(consumer.path, PROBE_LIBRARY_OUT, 'index.mjs'),
          extra: join(consumer.path, PROBE_LIBRARY_OUT, 'extra', 'index.mjs'),
        },
      }
    )
    expect(outputs).toEqual({ merged: { a: 1, b: 2 }, greeting: 'hello x', shouted: 'HELLO Y', VERSION: '1.0.0' })
  })

  it('builds the browser bundles from the root entry when the bundle configs omit entry', () => {
    const globals = consumer.run(
      async (args: BuiltBundles) => {
        const { readFileSync: read } = await import('node:fs')
        const { runInNewContext } = await import('node:vm')
        const iife: { Probe?: { merge: (a: object, b: object) => object } } = {}
        runInNewContext(read(args.iife, 'utf8'), iife)
        const umd = { exports: {} }
        runInNewContext(read(args.umd, 'utf8'), { module: umd, exports: umd.exports })
        return {
          iife: Object.keys(iife.Probe ?? {}).sort(),
          iifeMerge: iife.Probe?.merge({ a: 1 }, { b: 2 }),
          umd: Object.keys(umd.exports).sort(),
        }
      },
      {
        args: {
          iife: join(consumer.path, PROBE_LIBRARY_OUT, 'bundle', 'index.iife.min.js'),
          umd: join(consumer.path, PROBE_LIBRARY_OUT, 'bundle', 'index.umd.min.js'),
        },
      }
    )
    expect(globals).toEqual({ iife: ['VERSION', 'greet', 'merge'], iifeMerge: { a: 1, b: 2 }, umd: ['VERSION', 'greet', 'merge'] })
  })

  it('emits declarations a strict NodeNext consumer compiles without skipLibCheck', () => {
    const tsc = join(consumer.path, 'node_modules', 'typescript', 'bin', 'tsc')
    const run = consumer.node([tsc, '-p', join(consumer.path, 'typecheck')])
    expect({ status: run.status, output: run.stdout.trim() }).toEqual({ status: 0, output: '' })
  })
})
