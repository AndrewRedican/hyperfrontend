import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  let outputPath: string
  let depsRoot: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-orphan-'))
    depsRoot = join(outputPath, '_dependencies')
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  const write = (relPath: string, content = ''): string => {
    const abs = join(outputPath, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
    return abs
  }

  const listDeps = (suffix: string): string[] =>
    existsSync(depsRoot)
      ? readdirSync(depsRoot, { recursive: true })
          .map(String)
          .filter((p) => p.endsWith(suffix))
          .sort()
      : []

  it('returns zero counts when the dependencies root does not exist', () => {
    expect(pruneOrphanChunks(makeContext(outputPath), depsRoot)).toEqual({ orphanFilesRemoved: 0, bytesRemoved: 0 })
  })

  it('returns zero counts when the dependencies path is a file rather than a directory', () => {
    write('_dependencies', 'not a directory')
    expect(pruneOrphanChunks(makeContext(outputPath), depsRoot)).toEqual({ orphanFilesRemoved: 0, bytesRemoved: 0 })
  })

  it('deletes an esm chunk the entry never reaches and keeps the reachable one', () => {
    write('index.esm.js', "import {a} from './_dependencies/live/index.esm.js'")
    write('_dependencies/live/index.esm.js', 'export const a = 1')
    write('_dependencies/orphan/index.esm.js', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.esm.js')).toEqual(['live/index.esm.js'])
  })

  it('deletes a cjs chunk the entry never reaches', () => {
    write('index.cjs.js', "var a = require('./_dependencies/live/index.cjs.js')")
    write('_dependencies/live/index.cjs.js', 'exports.a = 1')
    write('_dependencies/orphan/index.cjs.js', 'exports.b = 1')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.cjs.js')).toEqual(['live/index.cjs.js'])
  })

  it('removes the .js.map sibling alongside an orphan chunk and counts both', () => {
    write('index.esm.js', 'export const a = 1')
    write('_dependencies/orphan/index.esm.js', 'export const b = 1')
    write('_dependencies/orphan/index.esm.js.map', '{}')
    const result = pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(result.orphanFilesRemoved).toBe(2)
  })

  it('reports the reclaimed byte total for removed files', () => {
    write('index.esm.js', 'export const a = 1')
    write('_dependencies/orphan/index.esm.js', 'abcde')
    const result = pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(result.bytesRemoved).toBe(5)
  })

  it('keeps every chunk when a reached chunk has a dynamic specifier', () => {
    write('index.esm.js', "import {a} from './_dependencies/dyn/index.esm.js'")
    write('_dependencies/dyn/index.esm.js', 'const m = require(name)')
    write('_dependencies/orphan/index.esm.js', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.esm.js')).toEqual(['dyn/index.esm.js', 'orphan/index.esm.js'])
  })

  it('reports zero removals on a dynamic-specifier bail', () => {
    write('index.esm.js', "import {a} from './_dependencies/dyn/index.esm.js'")
    write('_dependencies/dyn/index.esm.js', 'const m = require(name)')
    write('_dependencies/orphan/index.esm.js', 'export const b = 1')
    expect(pruneOrphanChunks(makeContext(outputPath), depsRoot)).toEqual({ orphanFilesRemoved: 0, bytesRemoved: 0 })
  })

  it('deletes an orphan d.ts when its js sibling was also pruned', () => {
    write('index.esm.js', 'export const a = 1')
    write('index.d.ts', 'export declare const a: number')
    write('_dependencies/orphan/index.esm.js', 'export const b = 1')
    write('_dependencies/orphan/index.d.ts', 'export declare const b: number')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.d.ts')).toEqual([])
  })

  it('deletes a dep d.ts the entry d.ts never references even when its runtime sibling survived the js sweep', () => {
    write('index.esm.js', "import {a} from './_dependencies/live/index.esm.js'")
    write('index.d.ts', 'export declare const a: number')
    write('_dependencies/live/index.esm.js', 'export const a = 1')
    write('_dependencies/live/index.d.ts', 'export declare const a: number')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.d.ts')).toEqual([])
  })

  it('keeps a d.ts reachable from the entry d.ts even without a runtime sibling', () => {
    write('index.d.ts', "import type {T} from './_dependencies/types/index.d.ts'")
    write('_dependencies/types/index.d.ts', 'export type T = string')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.d.ts')).toEqual(['types/index.d.ts'])
  })

  it('keeps a d.ts the entry d.ts reaches through a runtime (.js) specifier', () => {
    write('index.d.ts', "import {Plugin} from './_dependencies/dep/index.js'")
    write('_dependencies/dep/index.js', 'export const p = 1')
    write('_dependencies/dep/index.d.ts', 'export declare const Plugin: number')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.d.ts')).toEqual(['dep/index.d.ts'])
  })

  it('keeps a d.ts reached transitively through the type graph', () => {
    write('index.d.ts', "import {A} from './_dependencies/a/index.js'")
    write('_dependencies/a/index.js', 'export const a = 1')
    write('_dependencies/a/index.d.ts', "export {B} from '../b/index.js'\nexport declare const A: number")
    write('_dependencies/b/index.d.ts', 'export declare const B: number')
    write('_dependencies/orphan/index.d.ts', 'export declare const z: number')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.d.ts')).toEqual(['a/index.d.ts', 'b/index.d.ts'])
  })

  it('removes the .d.ts.map sibling alongside an orphan d.ts', () => {
    write('index.d.ts', 'export declare const a: number')
    write('_dependencies/orphan/index.d.ts', 'export declare const b: number')
    write('_dependencies/orphan/index.d.ts.map', '{}')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(existsSync(join(depsRoot, 'orphan/index.d.ts.map'))).toBe(false)
  })

  it('keeps every dep d.ts when a reached dep d.ts chunk bails on a dynamic specifier', () => {
    write('index.esm.js', 'export const a = 1')
    write('index.d.ts', "import {A} from './_dependencies/a/index.js'")
    write('_dependencies/a/index.d.ts', 'const lazy = import(typeName)\nexport declare const A: number')
    write('_dependencies/orphan/index.d.ts', 'export declare const b: number')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.d.ts').sort()).toEqual(['a/index.d.ts', 'orphan/index.d.ts'])
  })

  it('does not bail on a dynamic specifier in a first-party root d.ts and still prunes orphan dep d.ts', () => {
    // why: the bail guards intra-`_dependencies/` edges only; a dynamic specifier in a first-party root must not strand orphan dep d.ts files.
    write('index.esm.js', 'export const a = 1')
    write('index.d.ts', 'const lazy = import(typeName)')
    write('_dependencies/orphan/index.d.ts', 'export declare const b: number')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(listDeps('index.d.ts')).toEqual([])
  })

  it('removes directories left empty after pruning', () => {
    write('index.esm.js', 'export const a = 1')
    write('_dependencies/orphan/index.esm.js', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(existsSync(join(depsRoot, 'orphan'))).toBe(false)
  })

  it('recursively removes nested directory trees left empty after pruning', () => {
    write('index.esm.js', 'export const a = 1')
    write('_dependencies/@scope/pkg/sub/index.esm.js', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(existsSync(join(depsRoot, '@scope'))).toBe(false)
  })

  it('keeps a parent directory that still holds a surviving chunk after pruning a sibling', () => {
    write('index.esm.js', "import {a} from './_dependencies/@scope/live/index.esm.js'")
    write('_dependencies/@scope/live/index.esm.js', 'export const a = 1')
    write('_dependencies/@scope/orphan/index.esm.js', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputPath), depsRoot)
    expect(existsSync(join(depsRoot, '@scope/live/index.esm.js'))).toBe(true)
  })

  it('skips stray entry directories at or inside the dependencies root when collecting roots', () => {
    const atRoot: EntryPoint = { exportPath: './_dependencies', srcPath: '_dependencies', inputFile: '/x', isRoot: false }
    const underRoot: EntryPoint = { exportPath: './_dependencies/x', srcPath: '_dependencies/x', inputFile: '/x', isRoot: false }
    write('index.esm.js', "import {a} from './_dependencies/live/index.esm.js'")
    write('_dependencies/live/index.esm.js', 'export const a = 1')
    write('_dependencies/orphan/index.esm.js', 'export const b = 1')
    pruneOrphanChunks(makeContext(outputPath, [ROOT_ENTRY, atRoot, underRoot]), depsRoot)
    expect(listDeps('index.esm.js')).toEqual(['live/index.esm.js'])
  })
})
