import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { pruneDependencies } from './prune-dependencies'

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'root',
  entryPoints: entries,
  hasRootEntry: true,
  platformEntries: [],
  featureEntries: [],
})

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
  let outputPath: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-prune-deps-'))
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  const write = (relPath: string, content = ''): void => {
    const abs = join(outputPath, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
  }

  it('reports orphan removals from the Orphan Sweep with deadExportsRemoved zero', () => {
    write('index.mjs', 'export const a = 1')
    write('_dependencies/orphan/index.mjs', 'export const b = 1')
    expect(pruneDependencies(makeContext(outputPath))).toEqual({
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
    write('index.mjs', 'export const a = 1')
    expect(pruneDependencies(makeContext(outputPath))).toEqual({
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
    write('index.mjs', 'export const a = 1')
    const labels: string[] = []
    const monitor = { check: (label: string) => void labels.push(label) } as unknown as Parameters<typeof pruneDependencies>[1]
    pruneDependencies(makeContext(outputPath), monitor)
    expect(labels).toEqual([
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
    write('index.mjs', "import { getType } from './_dependencies/d/index.mjs'")
    write('_dependencies/d/index.mjs', 'const getType = 1;\nconst unused = 2;\nexport { getType, unused };')
    expect(pruneDependencies(makeContext(outputPath)).deadExportsRemoved).toBe(1)
  })

  it('drops an unread slot of a wholesale-imported namespace and cascades its factory away', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const use = SafeObject.freeze;")
    write(
      '_dependencies/d/index.mjs',
      'const freeze = 1;\nconst keys = 2;\nconst SafeObject = Object.freeze({ freeze, keys });\nexport { freeze, keys, SafeObject };'
    )
    const report = pruneDependencies(makeContext(outputPath))
    expect(report.deadPropertiesRemoved).toBe(1)
    const chunk = readFileSync(join(outputPath, '_dependencies/d/index.mjs'), 'utf8')
    expect(chunk).toContain('Object.freeze({ freeze })')
    expect(chunk).not.toContain('keys')
  })

  it('drops an unread slot of a CJS require namespace and cascades its factory away', () => {
    write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.use = d.SafeObject.freeze;")
    write(
      '_dependencies/d/index.cjs',
      'var freeze = 1;\nvar keys = 2;\nvar SafeObject = Object.freeze({ freeze, keys });\nexports.freeze = freeze;\nexports.keys = keys;\nexports.SafeObject = SafeObject;'
    )
    const report = pruneDependencies(makeContext(outputPath))
    expect(report.deadPropertiesRemoved).toBe(1)
    const chunk = readFileSync(join(outputPath, '_dependencies/d/index.cjs'), 'utf8')
    expect(chunk).toContain('Object.freeze({ freeze })')
    expect(chunk).not.toContain('keys')
  })

  it('keeps a namespace whole when a consumer reads it wholesale', () => {
    write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const all = { ...SafeObject };")
    write(
      '_dependencies/d/index.mjs',
      'const freeze = 1;\nconst keys = 2;\nconst SafeObject = Object.freeze({ freeze, keys });\nexport { SafeObject };'
    )
    expect(pruneDependencies(makeContext(outputPath)).deadPropertiesRemoved).toBe(0)
    expect(readFileSync(join(outputPath, '_dependencies/d/index.mjs'), 'utf8')).toContain('{ freeze, keys }')
  })

  it('destructures a whole-module CJS require binding read only as static members', () => {
    write('index.cjs', "const a = require('./_dependencies/a/index.cjs');\nexports.use = a.abs;")
    write('_dependencies/a/index.cjs', "const b = require('../b/index.cjs');\nconst abs = b.abs;\nexports.abs = abs;")
    write('_dependencies/b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;')
    const report = pruneDependencies(makeContext(outputPath))
    expect(report.requireBindingsDestructured).toBe(1)
    const chunk = readFileSync(join(outputPath, '_dependencies/a/index.cjs'), 'utf8')
    expect(chunk).toContain("const { abs: abs$1 } = require('../b/index.cjs')")
    expect(chunk).toContain('const abs = abs$1;')
  })

  it('leaves a require binding alone when the edge is part of a require cycle', () => {
    write('index.cjs', "const a = require('./_dependencies/a/index.cjs');\nexports.use = a.fa;")
    write('_dependencies/a/index.cjs', "const b = require('../b/index.cjs');\nconst fa = () => b.fb();\nexports.fa = fa;")
    write('_dependencies/b/index.cjs', "const a = require('../a/index.cjs');\nconst fb = () => a.fa();\nexports.fb = fb;")
    const report = pruneDependencies(makeContext(outputPath))
    expect(report.requireBindingsDestructured).toBe(0)
    expect(readFileSync(join(outputPath, '_dependencies/a/index.cjs'), 'utf8')).toContain("const b = require('../b/index.cjs')")
  })

  it('reclaims a chunk left orphaned once stripping drops its last importing edge', () => {
    write('index.mjs', "import { used } from './_dependencies/a/index.mjs'")
    write('_dependencies/a/index.mjs', "import { x } from '../b/index.mjs';\nconst used = 1;\nconst dead = x;\nexport { used, dead };")
    write('_dependencies/b/index.mjs', 'const x = 1;\nexport { x };')
    pruneDependencies(makeContext(outputPath))
    expect(existsSync(join(outputPath, '_dependencies/b/index.mjs'))).toBe(false)
  })

  it('synthesizes a demanded named export and keeps its interop default alive through the strip', () => {
    write('index.mjs', "import { inject } from './_dependencies/postject/index.mjs';\nexport const run = () => inject();")
    write(
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
    const report = pruneDependencies(makeContext(outputPath))
    const chunk = readFileSync(join(outputPath, '_dependencies/postject/index.mjs'), 'utf8')
    expect([report.namedExportsSynthesized, chunk.includes('export { inject$1 as inject };'), chunk.includes('const api = ')]).toEqual([
      1,
      true,
      true,
    ])
  })

  it('shims a chunk that still reads CJS module-scope globals', () => {
    write('index.mjs', "import { where } from './_dependencies/native/index.mjs';\nexport const dir = where;")
    write('_dependencies/native/index.mjs', 'function locate() { return __dirname; }\nconst where = locate();\nexport { where };')
    const report = pruneDependencies(makeContext(outputPath))
    const chunk = readFileSync(join(outputPath, '_dependencies/native/index.mjs'), 'utf8')
    expect([report.chunksShimmed, chunk.includes('const __dirname = __cjsPathDirname(__cjsFileURLToPath(import.meta.url));')]).toEqual([
      1,
      true,
    ])
  })
})
