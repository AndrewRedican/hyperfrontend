import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { normalizePath } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { pruneOrphanChunks } from './orphan-chunks'

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'root',
  entryPoints: entries,
  hasRootEntry: entries.some((e) => e.isRoot),
  platformEntries: [],
  featureEntries: [],
})

const makeContext = (outputPath: string, entries: EntryPoint[] = [ROOT_ENTRY]): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath,
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: makeDiscovery(entries),
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

describe('pruneOrphanChunks', () => {
  const outputDir = useTempDir({ prefix: 'builder-orphan-' })
  let depsRoot: string

  beforeEach(() => {
    depsRoot = outputDir.resolve('_dependencies')
  })

  const listDeps = (suffix: string): string[] =>
    existsSync(depsRoot)
      ? readdirSync(depsRoot, { recursive: true })
          .map((entry) => normalizePath(String(entry)))
          .filter((p) => p.endsWith(suffix))
          .sort()
      : []

  it('returns zero counts when the dependencies root does not exist', () => {
    expect(pruneOrphanChunks(makeContext(outputDir.path), depsRoot)).toEqual({ orphanFilesRemoved: 0, bytesRemoved: 0 })
  })

  it('returns zero counts when the dependencies path is a file rather than a directory', () => {
    outputDir.write('_dependencies', 'not a directory')
    expect(pruneOrphanChunks(makeContext(outputDir.path), depsRoot)).toEqual({ orphanFilesRemoved: 0, bytesRemoved: 0 })
  })

  it('deletes an esm chunk the entry never reaches and keeps the reachable one', () => {
    outputDir.write('index.mjs', "import {a} from './_dependencies/live/index.mjs'")
    outputDir.write('_dependencies/live/index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/orphan/index.mjs', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.mjs')).toEqual(['live/index.mjs'])
  })

  it('deletes a cjs chunk the entry never reaches', () => {
    outputDir.write('index.cjs', "var a = require('./_dependencies/live/index.cjs')")
    outputDir.write('_dependencies/live/index.cjs', 'exports.a = 1')
    outputDir.write('_dependencies/orphan/index.cjs', 'exports.b = 1')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.cjs')).toEqual(['live/index.cjs'])
  })

  it('removes the .map sibling alongside an orphan chunk and counts both', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/orphan/index.mjs', 'export const b = 1')
    outputDir.write('_dependencies/orphan/index.mjs.map', '{}')
    const result = pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(result.orphanFilesRemoved).toBe(2)
  })

  it('reports the reclaimed byte total for removed files', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/orphan/index.mjs', 'abcde')
    const result = pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(result.bytesRemoved).toBe(5)
  })

  it('keeps every chunk when a reached chunk has a dynamic specifier', () => {
    outputDir.write('index.mjs', "import {a} from './_dependencies/dyn/index.mjs'")
    outputDir.write('_dependencies/dyn/index.mjs', 'const m = require(name)')
    outputDir.write('_dependencies/orphan/index.mjs', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.mjs')).toEqual(['dyn/index.mjs', 'orphan/index.mjs'])
  })

  it('reports zero removals on a dynamic-specifier bail', () => {
    outputDir.write('index.mjs', "import {a} from './_dependencies/dyn/index.mjs'")
    outputDir.write('_dependencies/dyn/index.mjs', 'const m = require(name)')
    outputDir.write('_dependencies/orphan/index.mjs', 'export const b = 1')
    expect(pruneOrphanChunks(makeContext(outputDir.path), depsRoot)).toEqual({ orphanFilesRemoved: 0, bytesRemoved: 0 })
  })

  it('deletes an orphan d.ts when its js sibling was also pruned', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    outputDir.write('index.d.ts', 'export declare const a: number')
    outputDir.write('_dependencies/orphan/index.mjs', 'export const b = 1')
    outputDir.write('_dependencies/orphan/index.d.ts', 'export declare const b: number')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.d.ts')).toEqual([])
  })

  it('deletes a dep d.ts the entry d.ts never references even when its runtime sibling survived the js sweep', () => {
    outputDir.write('index.mjs', "import {a} from './_dependencies/live/index.mjs'")
    outputDir.write('index.d.ts', 'export declare const a: number')
    outputDir.write('_dependencies/live/index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/live/index.d.ts', 'export declare const a: number')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.d.ts')).toEqual([])
  })

  it('keeps a d.ts reachable from the entry d.ts even without a runtime sibling', () => {
    outputDir.write('index.d.ts', "import type {T} from './_dependencies/types/index.d.ts'")
    outputDir.write('_dependencies/types/index.d.ts', 'export type T = string')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.d.ts')).toEqual(['types/index.d.ts'])
  })

  it('keeps a d.ts the entry d.ts reaches through a runtime (.js) specifier', () => {
    outputDir.write('index.d.ts', "import {Plugin} from './_dependencies/dep/index.js'")
    outputDir.write('_dependencies/dep/index.js', 'export const p = 1')
    outputDir.write('_dependencies/dep/index.d.ts', 'export declare const Plugin: number')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.d.ts')).toEqual(['dep/index.d.ts'])
  })

  it('keeps a d.ts reached transitively through the type graph', () => {
    outputDir.write('index.d.ts', "import {A} from './_dependencies/a/index.js'")
    outputDir.write('_dependencies/a/index.js', 'export const a = 1')
    outputDir.write('_dependencies/a/index.d.ts', "export {B} from '../b/index.js'\nexport declare const A: number")
    outputDir.write('_dependencies/b/index.d.ts', 'export declare const B: number')
    outputDir.write('_dependencies/orphan/index.d.ts', 'export declare const z: number')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.d.ts')).toEqual(['a/index.d.ts', 'b/index.d.ts'])
  })

  it('removes the .d.ts.map sibling alongside an orphan d.ts', () => {
    outputDir.write('index.d.ts', 'export declare const a: number')
    outputDir.write('_dependencies/orphan/index.d.ts', 'export declare const b: number')
    outputDir.write('_dependencies/orphan/index.d.ts.map', '{}')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(existsSync(join(depsRoot, 'orphan/index.d.ts.map'))).toBe(false)
  })

  it('keeps every dep d.ts when a reached dep d.ts chunk bails on a dynamic specifier', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    outputDir.write('index.d.ts', "import {A} from './_dependencies/a/index.js'")
    outputDir.write('_dependencies/a/index.d.ts', 'const lazy = import(typeName)\nexport declare const A: number')
    outputDir.write('_dependencies/orphan/index.d.ts', 'export declare const b: number')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.d.ts').sort()).toEqual(['a/index.d.ts', 'orphan/index.d.ts'])
  })

  it('does not bail on a dynamic specifier in a first-party root d.ts and still prunes orphan dep d.ts', () => {
    // why: the bail guards intra-`_dependencies/` edges only; a dynamic specifier in a first-party root must not strand orphan dep d.ts files.
    outputDir.write('index.mjs', 'export const a = 1')
    outputDir.write('index.d.ts', 'const lazy = import(typeName)')
    outputDir.write('_dependencies/orphan/index.d.ts', 'export declare const b: number')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(listDeps('index.d.ts')).toEqual([])
  })

  it('removes directories left empty after pruning', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/orphan/index.mjs', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(existsSync(join(depsRoot, 'orphan'))).toBe(false)
  })

  it('recursively removes nested directory trees left empty after pruning', () => {
    outputDir.write('index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/@scope/pkg/sub/index.mjs', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(existsSync(join(depsRoot, '@scope'))).toBe(false)
  })

  it('keeps a parent directory that still holds a surviving chunk after pruning a sibling', () => {
    outputDir.write('index.mjs', "import {a} from './_dependencies/@scope/live/index.mjs'")
    outputDir.write('_dependencies/@scope/live/index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/@scope/orphan/index.mjs', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputDir.path), depsRoot)
    expect(existsSync(join(depsRoot, '@scope/live/index.mjs'))).toBe(true)
  })

  it('skips stray entry directories at or inside the dependencies root when collecting roots', () => {
    const atRoot: EntryPoint = { exportPath: './_dependencies', srcPath: '_dependencies', inputFile: '/x', isRoot: false }
    const underRoot: EntryPoint = { exportPath: './_dependencies/x', srcPath: '_dependencies/x', inputFile: '/x', isRoot: false }
    outputDir.write('index.mjs', "import {a} from './_dependencies/live/index.mjs'")
    outputDir.write('_dependencies/live/index.mjs', 'export const a = 1')
    outputDir.write('_dependencies/orphan/index.mjs', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputDir.path, [ROOT_ENTRY, atRoot, underRoot]), depsRoot)
    expect(listDeps('index.mjs')).toEqual(['live/index.mjs'])
  })
})
