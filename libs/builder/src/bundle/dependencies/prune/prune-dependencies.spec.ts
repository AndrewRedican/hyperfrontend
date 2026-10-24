import type { MemoryMonitor } from '../../../memory/monitor'
import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { createMock, describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { pruneDependencies } from './prune-dependencies'

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'root',
  entryPoints: entries,
  hasRootEntry: true,
  platformEntries: [],
  featureEntries: [],
})

const survivors = (code: string, fragments: string[]): string[] => fragments.filter((fragment) => code.includes(fragment))

const makeContext = (outputPath: string): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath,
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: makeDiscovery([ROOT_ENTRY]),
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

describe('pruneDependencies', () => {
  const outputDir = useTempDir({ prefix: 'builder-prune-deps-' })

  it('reports orphan removals from the Orphan Sweep with deadExportsRemoved zero', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/orphan/index.mjs', 'export const b = 1')
    expect(pruneDependencies(makeContext(outputDir.path))).toEqual({
      orphanFilesRemoved: 1,
      chunksShimmed: 0,
      namedExportsSynthesized: 0,
      deadExportsRemoved: 0,
      deadPropertiesRemoved: 0,
      requireBindingsDestructured: 0,
      commentBytesRemoved: 0,
      bytesRemoved: expect.any(Number),
    })
  })

  it('returns all-zero counts when there is no _dependencies directory', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    expect(pruneDependencies(makeContext(outputDir.path))).toEqual({
      orphanFilesRemoved: 0,
      chunksShimmed: 0,
      namedExportsSynthesized: 0,
      deadExportsRemoved: 0,
      deadPropertiesRemoved: 0,
      requireBindingsDestructured: 0,
      commentBytesRemoved: 0,
      bytesRemoved: 0,
    })
  })

  it('captures the orphan-sweep, shim, synthesis, dead-export, property-strip, destructure, and comment-strip checkpoints on the supplied monitor', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    const monitor = createMock<MemoryMonitor>()
    pruneDependencies(makeContext(outputDir.path), monitor)
    expect(monitor.check.mock.calls.flat()).toEqual([
      'bundle:dependencies:prune:orphans:end',
      'bundle:dependencies:prune:cjs-globals:end',
      'bundle:dependencies:prune:missing-exports:end',
      'bundle:dependencies:prune:dead-exports:end',
      'bundle:dependencies:prune:property-strip:end',
      'bundle:dependencies:prune:destructure-requires:end',
      'bundle:dependencies:prune:comment-strip:end',
    ])
  })

  it('counts dead exports stripped from a surviving chunk', () => {
    outputDir.write('index.mjs', "import { getType } from './_dependencies/d/index.mjs'")
    outputDir.write('_dependencies/d/index.mjs', 'const getType = 1;\nconst unused = 2;\nexport { getType, unused };')
    expect(pruneDependencies(makeContext(outputDir.path)).deadExportsRemoved).toBe(1)
  })

  const ESM_NS_CHUNK =
    'const freeze = 1;\nconst keys = 2;\nconst SafeObject = Object.freeze({ freeze, keys });\nexport { freeze, keys, SafeObject };'
  const CJS_NS_CHUNK =
    'var freeze = 1;\nvar keys = 2;\nvar SafeObject = Object.freeze({ freeze, keys });\nexports.freeze = freeze;\nexports.keys = keys;\nexports.SafeObject = SafeObject;'

  it('reports one dead property for an unread slot of a wholesale-imported namespace', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const use = SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.mjs', ESM_NS_CHUNK)
    expect(pruneDependencies(makeContext(outputDir.path)).deadPropertiesRemoved).toBe(1)
  })

  it('drops an unread slot of a wholesale-imported namespace and cascades its factory away', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const use = SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.mjs', ESM_NS_CHUNK)
    pruneDependencies(makeContext(outputDir.path))
    const chunk = outputDir.read('_dependencies/d/index.mjs')
    expect(survivors(chunk, ['Object.freeze({ freeze })', 'keys'])).toEqual(['Object.freeze({ freeze })'])
  })

  it('reports one dead property for an unread slot of a CJS require namespace', () => {
    outputDir.write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.use = d.SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(pruneDependencies(makeContext(outputDir.path)).deadPropertiesRemoved).toBe(1)
  })

  it('drops an unread slot of a CJS require namespace and cascades its factory away', () => {
    outputDir.write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.use = d.SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    pruneDependencies(makeContext(outputDir.path))
    const chunk = outputDir.read('_dependencies/d/index.cjs')
    expect(survivors(chunk, ['Object.freeze({ freeze })', 'keys'])).toEqual(['Object.freeze({ freeze })'])
  })

  const WHOLESALE_CHUNK = 'const freeze = 1;\nconst keys = 2;\nconst SafeObject = Object.freeze({ freeze, keys });\nexport { SafeObject };'

  it('reports no dead property when a consumer reads a namespace wholesale', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const all = { ...SafeObject };")
    outputDir.write('_dependencies/d/index.mjs', WHOLESALE_CHUNK)
    expect(pruneDependencies(makeContext(outputDir.path)).deadPropertiesRemoved).toBe(0)
  })

  it('keeps a namespace whole when a consumer reads it wholesale', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const all = { ...SafeObject };")
    outputDir.write('_dependencies/d/index.mjs', WHOLESALE_CHUNK)
    pruneDependencies(makeContext(outputDir.path))
    expect(outputDir.read('_dependencies/d/index.mjs')).toBe(WHOLESALE_CHUNK)
  })

  it('reports one destructured binding for a whole-module CJS require read only as static members', () => {
    outputDir.write('index.cjs', "const a = require('./_dependencies/a/index.cjs');\nexports.use = a.abs;")
    outputDir.write('_dependencies/a/index.cjs', "const b = require('../b/index.cjs');\nconst abs = b.abs;\nexports.abs = abs;")
    outputDir.write('_dependencies/b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;')
    expect(pruneDependencies(makeContext(outputDir.path)).requireBindingsDestructured).toBe(1)
  })

  it('destructures a whole-module CJS require binding read only as static members', () => {
    outputDir.write('index.cjs', "const a = require('./_dependencies/a/index.cjs');\nexports.use = a.abs;")
    outputDir.write('_dependencies/a/index.cjs', "const b = require('../b/index.cjs');\nconst abs = b.abs;\nexports.abs = abs;")
    outputDir.write('_dependencies/b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;')
    pruneDependencies(makeContext(outputDir.path))
    expect(outputDir.read('_dependencies/a/index.cjs')).toBe(
      "const { abs: abs$1 } = require('../b/index.cjs');\nconst abs = abs$1;\nexports.abs = abs;"
    )
  })

  const CYCLE_CHUNK_A = "const b = require('../b/index.cjs');\nconst fa = () => b.fb();\nexports.fa = fa;"
  const CYCLE_CHUNK_B = "const a = require('../a/index.cjs');\nconst fb = () => a.fa();\nexports.fb = fb;"

  it('reports no destructured binding when the edge is part of a require cycle', () => {
    outputDir.write('index.cjs', "const a = require('./_dependencies/a/index.cjs');\nexports.use = a.fa;")
    outputDir.write('_dependencies/a/index.cjs', CYCLE_CHUNK_A)
    outputDir.write('_dependencies/b/index.cjs', CYCLE_CHUNK_B)
    expect(pruneDependencies(makeContext(outputDir.path)).requireBindingsDestructured).toBe(0)
  })

  it('leaves a require binding alone when the edge is part of a require cycle', () => {
    outputDir.write('index.cjs', "const a = require('./_dependencies/a/index.cjs');\nexports.use = a.fa;")
    outputDir.write('_dependencies/a/index.cjs', CYCLE_CHUNK_A)
    outputDir.write('_dependencies/b/index.cjs', CYCLE_CHUNK_B)
    pruneDependencies(makeContext(outputDir.path))
    expect(outputDir.read('_dependencies/a/index.cjs')).toBe(CYCLE_CHUNK_A)
  })

  it('reclaims a chunk left orphaned once stripping drops its last importing edge', () => {
    outputDir.write('index.mjs', "import { used } from './_dependencies/a/index.mjs'")
    outputDir.write(
      '_dependencies/a/index.mjs',
      "import { x } from '../b/index.mjs';\nconst used = 1;\nconst dead = x;\nexport { used, dead };"
    )
    outputDir.write('_dependencies/b/index.mjs', 'const x = 1;\nexport { x };')
    pruneDependencies(makeContext(outputDir.path))
    expect(outputDir.exists('_dependencies/b/index.mjs')).toBe(false)
  })

  it('synthesizes a demanded named export and keeps its interop default alive through the strip', () => {
    outputDir.write('index.mjs', "import { inject } from './_dependencies/postject/index.mjs';\nexport const run = () => inject();")
    outputDir.write(
      '_dependencies/postject/index.mjs',
      [
        'function requireApi() {',
        '  return { inject: () => 1 };',
        '}',
        'var apiExports = requireApi();',
        'const api = /*@__PURE__*/getDefaultExportFromCjs(apiExports);',
        'export { api as default };',
        '',
      ].join('\n')
    )
    const report = pruneDependencies(makeContext(outputDir.path))
    const chunk = outputDir.read('_dependencies/postject/index.mjs')
    expect([report.namedExportsSynthesized, chunk.includes('export { inject$1 as inject };'), chunk.includes('const api = ')]).toEqual([
      1,
      true,
      true,
    ])
  })

  it('shims a chunk that still reads CJS module-scope globals', () => {
    outputDir.write('index.mjs', "import { where } from './_dependencies/native/index.mjs';\nexport const dir = where;")
    outputDir.write('_dependencies/native/index.mjs', 'function locate() { return __dirname; }\nconst where = locate();\nexport { where };')
    const report = pruneDependencies(makeContext(outputDir.path))
    const chunk = outputDir.read('_dependencies/native/index.mjs')
    expect([report.chunksShimmed, chunk.includes('const __dirname = __cjsPathDirname(__cjsFileURLToPath(import.meta.url));')]).toEqual([
      1,
      true,
    ])
  })
})
