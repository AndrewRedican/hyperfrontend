import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  it('reports orphan removals from the Tier-1 sweep with deadExportsRemoved zero', () => {
    write('index.esm.js', 'export const a = 1')
    write('_dependencies/orphan/index.esm.js', 'export const b = 1')
    expect(pruneDependencies(makeContext(outputPath))).toEqual({
      orphanFilesRemoved: 1,
      deadExportsRemoved: 0,
      bytesRemoved: expect.any(Number),
    })
  })

  it('returns all-zero counts when there is no _dependencies directory', () => {
    write('index.esm.js', 'export const a = 1')
    expect(pruneDependencies(makeContext(outputPath))).toEqual({ orphanFilesRemoved: 0, deadExportsRemoved: 0, bytesRemoved: 0 })
  })

  it('captures the orphan-sweep and dead-export checkpoints on the supplied monitor', () => {
    write('index.esm.js', 'export const a = 1')
    const labels: string[] = []
    const monitor = { check: (label: string) => void labels.push(label) } as unknown as Parameters<typeof pruneDependencies>[1]
    pruneDependencies(makeContext(outputPath), monitor)
    expect(labels).toEqual(['bundle:dependencies:prune:orphans:end', 'bundle:dependencies:prune:dead-exports:end'])
  })

  it('counts dead exports stripped from a surviving chunk', () => {
    write('index.esm.js', "import { getType } from './_dependencies/d/index.esm.js'")
    write('_dependencies/d/index.esm.js', 'const getType = 1;\nconst unused = 2;\nexport { getType, unused };')
    expect(pruneDependencies(makeContext(outputPath)).deadExportsRemoved).toBe(1)
  })

  it('reclaims a chunk left orphaned once stripping drops its last importing edge', () => {
    write('index.esm.js', "import { used } from './_dependencies/a/index.esm.js'")
    write(
      '_dependencies/a/index.esm.js',
      "import { x } from '../b/index.esm.js';\nconst used = 1;\nconst dead = x;\nexport { used, dead };"
    )
    write('_dependencies/b/index.esm.js', 'const x = 1;\nexport { x };')
    pruneDependencies(makeContext(outputPath))
    expect(existsSync(join(outputPath, '_dependencies/b/index.esm.js'))).toBe(false)
  })
})
