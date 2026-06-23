import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../models'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

describe('pruneOrphanDeclarations', () => {
  let outputPath: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-prune-'))
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  it('removes per-source .d.ts and .d.ts.map orphans, keeping index.d.ts and index.d.ts.map', () => {
    const dir = join(outputPath, 'bin', 'native')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.d.ts'), '')
    writeFileSync(join(dir, 'index.d.ts.map'), '')
    writeFileSync(join(dir, 'build-native.d.ts'), '')
    writeFileSync(join(dir, 'build-native.d.ts.map'), '')
    writeFileSync(join(dir, 'codesign.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [SUB_ENTRY]))
    expect(removed).toBe(3)
    expect(namesIn(dir)).toEqual(['index.d.ts', 'index.d.ts.map'])
  })

  it('does not touch non-d.ts files like index.cjs.js or index.esm.js', () => {
    const dir = join(outputPath, 'bundle')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.d.ts'), '')
    writeFileSync(join(dir, 'index.cjs.js'), '')
    writeFileSync(join(dir, 'index.esm.js'), '')
    writeFileSync(join(dir, 'helper.d.ts'), '')
    pruneOrphanDeclarations(makeContext(outputPath, [BUNDLE_ENTRY]))
    expect(namesIn(dir)).toEqual(['index.cjs.js', 'index.d.ts', 'index.esm.js'])
  })

  it('recurses into internal subdirectories, pruning unreachable orphans', () => {
    const dir = join(outputPath, 'bundle')
    const child = join(dir, 'rollup')
    mkdirSync(child, { recursive: true })
    writeFileSync(join(dir, 'index.d.ts'), '')
    writeFileSync(join(child, 'orphan.d.ts'), '')
    pruneOrphanDeclarations(makeContext(outputPath, [BUNDLE_ENTRY]))
    expect(namesIn(child)).toEqual([])
  })

  it('prunes the dist root when there is a root entry', () => {
    writeFileSync(join(outputPath, 'index.d.ts'), '')
    writeFileSync(join(outputPath, 'build.d.ts'), '')
    writeFileSync(join(outputPath, 'build.d.ts.map'), '')
    pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(namesIn(outputPath)).toEqual(['index.d.ts'])
  })

  it('skips entries whose directory does not exist on disk', () => {
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [SUB_ENTRY]))
    expect(removed).toBe(0)
  })

  it('never recurses into _dependencies/ even if a stray entry points there', () => {
    const depsRoot = join(outputPath, '_dependencies')
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
    pruneOrphanDeclarations(makeContext(outputPath, [strayEntry]))
    expect(namesIn(depDir)).toEqual(['index.d.ts', 'orphan.d.ts'])
  })

  it('returns zero and is silent when there is nothing to remove', () => {
    const dir = join(outputPath, 'bundle')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.d.ts'), '')
    expect(pruneOrphanDeclarations(makeContext(outputPath, [BUNDLE_ENTRY]))).toBe(0)
  })

  it('keeps siblings the surviving index.d.ts still re-exports from (skipped flatten)', () => {
    writeFileSync(
      join(outputPath, 'index.d.ts'),
      [
        "export { createLogger } from './create-logger'",
        "export type { Logger } from './create-logger'",
        "export { logger } from './logger'",
      ].join('\n')
    )
    writeFileSync(join(outputPath, 'create-logger.d.ts'), '')
    writeFileSync(join(outputPath, 'create-logger.d.ts.map'), '')
    writeFileSync(join(outputPath, 'logger.d.ts'), '')
    writeFileSync(join(outputPath, 'orphan.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(1)
    expect(namesIn(outputPath)).toEqual(['create-logger.d.ts', 'create-logger.d.ts.map', 'index.d.ts', 'logger.d.ts'])
  })

  it('prunes every sibling once the flatten has made index.d.ts self-contained', () => {
    writeFileSync(join(outputPath, 'index.d.ts'), 'export declare const createLogger: () => void;\n')
    writeFileSync(join(outputPath, 'create-logger.d.ts'), '')
    writeFileSync(join(outputPath, 'logger.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(2)
    expect(namesIn(outputPath)).toEqual(['index.d.ts'])
  })

  it('keeps a sibling referenced via a dynamic type import', () => {
    writeFileSync(join(outputPath, 'index.d.ts'), 'export type Cfg = typeof import("./config");\n')
    writeFileSync(join(outputPath, 'config.d.ts'), '')
    writeFileSync(join(outputPath, 'orphan.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(1)
    expect(namesIn(outputPath)).toEqual(['config.d.ts', 'index.d.ts'])
  })

  it('processes every entry directory in a multi-entry build', () => {
    const dirA = join(outputPath, 'bundle')
    const dirB = join(outputPath, 'bin', 'native')
    mkdirSync(dirA, { recursive: true })
    mkdirSync(dirB, { recursive: true })
    writeFileSync(join(dirA, 'index.d.ts'), '')
    writeFileSync(join(dirA, 'orphan-a.d.ts'), '')
    writeFileSync(join(dirB, 'index.d.ts'), '')
    writeFileSync(join(dirB, 'orphan-b.d.ts'), '')
    writeFileSync(join(dirB, 'orphan-b.d.ts.map'), '')
    expect(pruneOrphanDeclarations(makeContext(outputPath, [BUNDLE_ENTRY, SUB_ENTRY]))).toBe(3)
    expect(namesIn(dirA)).toEqual(['index.d.ts'])
    expect(namesIn(dirB)).toEqual(['index.d.ts'])
  })

  it('keeps a sibling reachable only transitively through a non-index .d.ts', () => {
    const shared = join(outputPath, 'shared')
    mkdirSync(shared, { recursive: true })
    writeFileSync(join(outputPath, 'index.d.ts'), "export { Consts } from './shared/consts'\n")
    writeFileSync(join(shared, 'consts.d.ts'), "export { Helpers } from './helpers'\n")
    writeFileSync(join(shared, 'helpers.d.ts'), '')
    writeFileSync(join(shared, 'orphan.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(1)
    expect(namesIn(shared)).toEqual(['consts.d.ts', 'helpers.d.ts'])
  })

  it('resolves a directory import to its index.d.ts, keeping it', () => {
    const shared = join(outputPath, 'shared')
    mkdirSync(shared, { recursive: true })
    writeFileSync(join(outputPath, 'index.d.ts'), "export { Shared } from './shared'\n")
    writeFileSync(join(shared, 'index.d.ts'), '')
    writeFileSync(join(shared, 'dead.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(1)
    expect(namesIn(shared)).toEqual(['index.d.ts'])
  })

  it('deletes an unreferenced non-entry index.d.ts', () => {
    const internal = join(outputPath, 'internal')
    mkdirSync(internal, { recursive: true })
    writeFileSync(join(outputPath, 'index.d.ts'), '')
    writeFileSync(join(internal, 'index.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(1)
    expect(namesIn(internal)).toEqual([])
  })

  it('keeps all declarations when a reached d.ts has a dynamic specifier', () => {
    writeFileSync(join(outputPath, 'index.d.ts'), 'export type T = typeof import("./" + name);\n')
    writeFileSync(join(outputPath, 'orphan.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(0)
    expect(namesIn(outputPath)).toEqual(['index.d.ts', 'orphan.d.ts'])
  })

  it('treats a reference into _dependencies as a non-edge and leaves it untouched', () => {
    const depDir = join(outputPath, '_dependencies', 'dep')
    mkdirSync(depDir, { recursive: true })
    writeFileSync(join(outputPath, 'index.d.ts'), "export { Dep } from './_dependencies/dep/index.js'\n")
    writeFileSync(join(depDir, 'index.d.ts'), '')
    writeFileSync(join(outputPath, 'orphan.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(1)
    expect(namesIn(depDir)).toEqual(['index.d.ts'])
  })

  it('drops a specifier that resolves to no file on disk', () => {
    writeFileSync(join(outputPath, 'index.d.ts'), "export { Gone } from './missing'\n")
    writeFileSync(join(outputPath, 'orphan.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(1)
    expect(namesIn(outputPath)).toEqual(['index.d.ts'])
  })

  it('returns zero when the output root does not exist', () => {
    expect(pruneOrphanDeclarations(makeContext(join(outputPath, 'absent'), [ROOT_ENTRY]))).toBe(0)
  })

  it('resolves a .js-extension specifier onto its .d.ts sibling', () => {
    writeFileSync(join(outputPath, 'index.d.ts'), "export { createLogger } from './create-logger.js'\n")
    writeFileSync(join(outputPath, 'create-logger.d.ts'), '')
    writeFileSync(join(outputPath, 'orphan.d.ts'), '')
    const removed = pruneOrphanDeclarations(makeContext(outputPath, [ROOT_ENTRY]))
    expect(removed).toBe(1)
    expect(namesIn(outputPath)).toEqual(['create-logger.d.ts', 'index.d.ts'])
  })
})
