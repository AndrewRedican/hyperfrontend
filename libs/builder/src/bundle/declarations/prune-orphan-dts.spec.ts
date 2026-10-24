import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../models'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { pruneOrphanDeclarations } from './prune-orphan-dts'

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }
const SUB_ENTRY: EntryPoint = {
  exportPath: './bin/native',
  srcPath: 'bin/native',
  inputFile: '/abs/src/bin/native/index.ts',
  isRoot: false,
}
const BUNDLE_ENTRY: EntryPoint = { exportPath: './bundle', srcPath: 'bundle', inputFile: '/abs/src/bundle/index.ts', isRoot: false }

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'hybrid',
  entryPoints: entries,
  hasRootEntry: entries.some((e) => e.isRoot),
  platformEntries: [],
  featureEntries: [],
})

const makeContext = (outputPath: string, entries: EntryPoint[]): BuildContext => ({
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

const namesIn = (dir: string): string[] => readdirSync(dir).sort()

const touch = (dir: string, names: string[]): void => {
  mkdirSync(dir, { recursive: true })
  for (const name of names) writeFileSync(join(dir, name), '')
}

describe('pruneOrphanDeclarations', () => {
  const outputDir = useTempDir({ prefix: 'builder-prune-' })

  it('removes per-source .d.ts and .d.ts.map orphans, keeping index.d.ts and index.d.ts.map', () => {
    const dir = outputDir.resolve('bin', 'native')
    touch(dir, ['index.d.ts', 'index.d.ts.map', 'build-native.d.ts', 'build-native.d.ts.map', 'codesign.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [SUB_ENTRY]))
    expect(namesIn(dir)).toEqual(['index.d.ts', 'index.d.ts.map'])
  })

  it('reports three removals for the per-source orphans beside an entry index', () => {
    const dir = outputDir.resolve('bin', 'native')
    touch(dir, ['index.d.ts', 'index.d.ts.map', 'build-native.d.ts', 'build-native.d.ts.map', 'codesign.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [SUB_ENTRY]))).toBe(3)
  })

  it('does not touch non-d.ts files like index.cjs or index.mjs', () => {
    const dir = outputDir.resolve('bundle')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.d.ts'), '')
    writeFileSync(join(dir, 'index.cjs'), '')
    writeFileSync(join(dir, 'index.mjs'), '')
    writeFileSync(join(dir, 'helper.d.ts'), '')
    pruneOrphanDeclarations(makeContext(outputDir.path, [BUNDLE_ENTRY]))
    expect(namesIn(dir)).toEqual(['index.cjs', 'index.d.ts', 'index.mjs'])
  })

  it('recurses into internal subdirectories, pruning unreachable orphans', () => {
    const dir = outputDir.resolve('bundle')
    const child = join(dir, 'rollup')
    mkdirSync(child, { recursive: true })
    writeFileSync(join(dir, 'index.d.ts'), '')
    writeFileSync(join(child, 'orphan.d.ts'), '')
    pruneOrphanDeclarations(makeContext(outputDir.path, [BUNDLE_ENTRY]))
    expect(namesIn(child)).toEqual([])
  })

  it('prunes the dist root when there is a root entry', () => {
    outputDir.write('index.d.ts', '')
    outputDir.write('build.d.ts', '')
    outputDir.write('build.d.ts.map', '')
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(outputDir.path)).toEqual(['index.d.ts'])
  })

  it('skips entries whose directory does not exist on disk', () => {
    const removed = pruneOrphanDeclarations(makeContext(outputDir.path, [SUB_ENTRY]))
    expect(removed).toBe(0)
  })

  it('never recurses into _dependencies/ even if a stray entry points there', () => {
    const depsRoot = outputDir.resolve('_dependencies')
    const depDir = join(depsRoot, 'rollup')
    mkdirSync(depDir, { recursive: true })
    writeFileSync(join(depDir, 'orphan.d.ts'), '')
    writeFileSync(join(depDir, 'index.d.ts'), '')
    const strayEntry: EntryPoint = {
      exportPath: './_dependencies/rollup',
      srcPath: '_dependencies/rollup',
      inputFile: '/x',
      isRoot: false,
    }
    pruneOrphanDeclarations(makeContext(outputDir.path, [strayEntry]))
    expect(namesIn(depDir)).toEqual(['index.d.ts', 'orphan.d.ts'])
  })

  it('returns zero and is silent when there is nothing to remove', () => {
    const dir = outputDir.resolve('bundle')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.d.ts'), '')
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [BUNDLE_ENTRY]))).toBe(0)
  })

  const reExportingIndex = [
    "export { createLogger } from './create-logger'",
    "export type { Logger } from './create-logger'",
    "export { logger } from './logger'",
  ].join('\n')

  it('keeps siblings the surviving index.d.ts still re-exports from (skipped flatten)', () => {
    outputDir.write('index.d.ts', reExportingIndex)
    touch(outputDir.path, ['create-logger.d.ts', 'create-logger.d.ts.map', 'logger.d.ts', 'orphan.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(outputDir.path)).toEqual(['create-logger.d.ts', 'create-logger.d.ts.map', 'index.d.ts', 'logger.d.ts'])
  })

  it('reports one removal when the surviving index.d.ts still re-exports its siblings', () => {
    outputDir.write('index.d.ts', reExportingIndex)
    touch(outputDir.path, ['create-logger.d.ts', 'create-logger.d.ts.map', 'logger.d.ts', 'orphan.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(1)
  })

  it('prunes every sibling once the flatten has made index.d.ts self-contained', () => {
    outputDir.write('index.d.ts', 'export declare const createLogger: () => void;\n')
    touch(outputDir.path, ['create-logger.d.ts', 'logger.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(outputDir.path)).toEqual(['index.d.ts'])
  })

  it('reports two removals once the flatten has made index.d.ts self-contained', () => {
    outputDir.write('index.d.ts', 'export declare const createLogger: () => void;\n')
    touch(outputDir.path, ['create-logger.d.ts', 'logger.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(2)
  })

  it('keeps a sibling referenced via a dynamic type import', () => {
    outputDir.write('index.d.ts', 'export type Cfg = typeof import("./config");\n')
    touch(outputDir.path, ['config.d.ts', 'orphan.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(outputDir.path)).toEqual(['config.d.ts', 'index.d.ts'])
  })

  it('reports one removal when a sibling is kept via a dynamic type import', () => {
    outputDir.write('index.d.ts', 'export type Cfg = typeof import("./config");\n')
    touch(outputDir.path, ['config.d.ts', 'orphan.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(1)
  })

  it('processes every entry directory in a multi-entry build', () => {
    const dirA = outputDir.resolve('bundle')
    const dirB = outputDir.resolve('bin', 'native')
    touch(dirA, ['index.d.ts', 'orphan-a.d.ts'])
    touch(dirB, ['index.d.ts', 'orphan-b.d.ts', 'orphan-b.d.ts.map'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [BUNDLE_ENTRY, SUB_ENTRY]))
    for (const dir of [dirA, dirB]) expect(namesIn(dir)).toEqual(['index.d.ts'])
  })

  it('reports the removals across every entry directory in a multi-entry build', () => {
    touch(outputDir.resolve('bundle'), ['index.d.ts', 'orphan-a.d.ts'])
    touch(outputDir.resolve('bin', 'native'), ['index.d.ts', 'orphan-b.d.ts', 'orphan-b.d.ts.map'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [BUNDLE_ENTRY, SUB_ENTRY]))).toBe(3)
  })

  it('keeps a sibling reachable only transitively through a non-index .d.ts', () => {
    const shared = outputDir.resolve('shared')
    outputDir.write('index.d.ts', "export { Consts } from './shared/consts'\n")
    touch(shared, ['helpers.d.ts', 'orphan.d.ts'])
    writeFileSync(join(shared, 'consts.d.ts'), "export { Helpers } from './helpers'\n")
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(shared)).toEqual(['consts.d.ts', 'helpers.d.ts'])
  })

  it('reports one removal when a sibling is reachable only transitively', () => {
    const shared = outputDir.resolve('shared')
    outputDir.write('index.d.ts', "export { Consts } from './shared/consts'\n")
    touch(shared, ['helpers.d.ts', 'orphan.d.ts'])
    writeFileSync(join(shared, 'consts.d.ts'), "export { Helpers } from './helpers'\n")
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(1)
  })

  it('resolves a directory import to its index.d.ts, keeping it', () => {
    const shared = outputDir.resolve('shared')
    outputDir.write('index.d.ts', "export { Shared } from './shared'\n")
    touch(shared, ['index.d.ts', 'dead.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(shared)).toEqual(['index.d.ts'])
  })

  it('reports one removal when a directory import resolves to its index.d.ts', () => {
    outputDir.write('index.d.ts', "export { Shared } from './shared'\n")
    touch(outputDir.resolve('shared'), ['index.d.ts', 'dead.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(1)
  })

  it('deletes an unreferenced non-entry index.d.ts', () => {
    const internal = outputDir.resolve('internal')
    touch(outputDir.path, ['index.d.ts'])
    touch(internal, ['index.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(internal)).toEqual([])
  })

  it('reports one removal for an unreferenced non-entry index.d.ts', () => {
    touch(outputDir.path, ['index.d.ts'])
    touch(outputDir.resolve('internal'), ['index.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(1)
  })

  it('keeps all declarations when a reached d.ts has a dynamic specifier', () => {
    outputDir.write('index.d.ts', 'export type T = typeof import("./" + name);\n')
    touch(outputDir.path, ['orphan.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(outputDir.path)).toEqual(['index.d.ts', 'orphan.d.ts'])
  })

  it('reports no removals when a reached d.ts has a dynamic specifier', () => {
    outputDir.write('index.d.ts', 'export type T = typeof import("./" + name);\n')
    touch(outputDir.path, ['orphan.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(0)
  })

  it('treats a reference into _dependencies as a non-edge and leaves it untouched', () => {
    const depDir = outputDir.resolve('_dependencies', 'dep')
    outputDir.write('index.d.ts', "export { Dep } from './_dependencies/dep/index.js'\n")
    touch(depDir, ['index.d.ts'])
    touch(outputDir.path, ['orphan.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(depDir)).toEqual(['index.d.ts'])
  })

  it('reports one removal when a reference into _dependencies is a non-edge', () => {
    outputDir.write('index.d.ts', "export { Dep } from './_dependencies/dep/index.js'\n")
    touch(outputDir.resolve('_dependencies', 'dep'), ['index.d.ts'])
    touch(outputDir.path, ['orphan.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(1)
  })

  it('drops a specifier that resolves to no file on disk', () => {
    outputDir.write('index.d.ts', "export { Gone } from './missing'\n")
    touch(outputDir.path, ['orphan.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(outputDir.path)).toEqual(['index.d.ts'])
  })

  it('reports one removal when a specifier resolves to no file on disk', () => {
    outputDir.write('index.d.ts', "export { Gone } from './missing'\n")
    touch(outputDir.path, ['orphan.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(1)
  })

  it('returns zero when the output root does not exist', () => {
    expect(pruneOrphanDeclarations(makeContext(outputDir.resolve('absent'), [ROOT_ENTRY]))).toBe(0)
  })

  it('resolves a .js-extension specifier onto its .d.ts sibling', () => {
    outputDir.write('index.d.ts', "export { createLogger } from './create-logger.js'\n")
    touch(outputDir.path, ['create-logger.d.ts', 'orphan.d.ts'])
    pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))
    expect(namesIn(outputDir.path)).toEqual(['create-logger.d.ts', 'index.d.ts'])
  })

  it('reports one removal when a .js-extension specifier resolves onto its .d.ts sibling', () => {
    outputDir.write('index.d.ts', "export { createLogger } from './create-logger.js'\n")
    touch(outputDir.path, ['create-logger.d.ts', 'orphan.d.ts'])
    expect(pruneOrphanDeclarations(makeContext(outputDir.path, [ROOT_ENTRY]))).toBe(1)
  })
})
