import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../models'
import { exists } from '@hyperfrontend/project-scope/core/fs'
import { resolveDefaultWorkerPath, runPrePass } from '../dependencies/pre-pass'
import { runDtsPerEntry } from './dts-per-entry'
jest.mock('../dependencies/pre-pass', () => ({
  runPrePass: jest.fn().mockResolvedValue([]),
  resolveDefaultWorkerPath: jest.fn(),
}))
jest.mock('@hyperfrontend/project-scope/core/fs', () => {
  const actual = jest.requireActual('@hyperfrontend/project-scope/core/fs')
  return { ...actual, exists: jest.fn() }
})
jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return { ...actual, logger: { channel: jest.fn(() => mockChannel) } }
})

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/libs/foo/src/index.ts', isRoot: true }
const SUB_ENTRY: EntryPoint = { exportPath: './sub', srcPath: 'sub', inputFile: '/abs/libs/foo/src/sub/index.ts', isRoot: false }

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'root',
  entryPoints: entries,
  hasRootEntry: entries.some((e) => e.isRoot),
  platformEntries: [],
  featureEntries: [],
})

const makeContext = (bundledDeps: string[], entries: EntryPoint[]): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: makeDiscovery(entries),
  bundledDeps,
  workspaceBundledDeps: [],
  startedAt: 0,
})

beforeEach(() => {
  ;(<jest.Mock>runPrePass).mockClear()
  ;(<jest.Mock>resolveDefaultWorkerPath)
    .mockReset()
    .mockReturnValue({ path: '/abs/dist/libs/builder/bundle/dependencies/worker/index.cjs.js', execArgv: [] })
  ;(<jest.Mock>exists).mockReset().mockReturnValue(true)
})

describe('runDtsPerEntry', () => {
  it('is a no-op when neither npm nor workspace deps are configured', async () => {
    await runDtsPerEntry(makeContext([], [ROOT_ENTRY]))
    expect(runPrePass).not.toHaveBeenCalled()
  })

  it('runs the flatten when only workspace deps are bundled (no npm deps)', async () => {
    const ctx = makeContext([], [ROOT_ENTRY])
    ctx.workspaceBundledDeps = [
      {
        packageName: '@hyperfrontend/logging',
        specifier: '@hyperfrontend/logging',
        subPath: '',
        policy: 'whole-surface',
        inputPath: '/abs/repo/libs/logging/src/index.ts',
        tsConfigPath: '/abs/repo/libs/logging/tsconfig.lib.json',
      },
    ]
    await runDtsPerEntry(ctx)
    expect(runPrePass).toHaveBeenCalledTimes(1)
    const jobs = (<jest.Mock>runPrePass).mock.calls[0][0]
    expect(jobs).toHaveLength(1)
    expect(jobs[0].inputPath).toBe('/abs/dist/libs/foo/index.d.ts')
  })

  it('throws a context-rich error when the worker artifact is missing', async () => {
    ;(<jest.Mock>resolveDefaultWorkerPath).mockReturnValueOnce(undefined)
    await expect(runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY]))).rejects.toThrow(/worker artifact was not found/)
  })

  it('builds one dts job per entry whose tsc-emitted .d.ts exists', async () => {
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY, SUB_ENTRY]))
    expect(runPrePass).toHaveBeenCalledTimes(1)
    const jobs = (<jest.Mock>runPrePass).mock.calls[0][0]
    expect(jobs).toHaveLength(2)
    expect(jobs[0].inputPath).toBe('/abs/dist/libs/foo/index.d.ts')
    expect(jobs[1].inputPath).toBe('/abs/dist/libs/foo/sub/index.d.ts')
    expect(jobs.every((j: { kind: string; otherDeps: string[] }) => j.kind === 'dts' && j.otherDeps.includes('rollup'))).toBe(true)
  })

  it('threads sibling-entry descriptors and selfDtsPath into each job', async () => {
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY, SUB_ENTRY]))
    const jobs = (<jest.Mock>runPrePass).mock.calls[0][0]
    expect(jobs[0].selfDtsPath).toBe('/abs/dist/libs/foo/index.d.ts')
    expect(jobs[0].selfSrcPath).toBe('')
    expect(jobs[0].siblingEntries).toEqual([{ srcPath: 'sub', indexDtsPath: '/abs/dist/libs/foo/sub/index.d.ts' }])
    expect(jobs[1].selfDtsPath).toBe('/abs/dist/libs/foo/sub/index.d.ts')
    expect(jobs[1].siblingEntries).toEqual([{ srcPath: '', indexDtsPath: '/abs/dist/libs/foo/index.d.ts' }])
  })

  it('skips entries whose tsc output is missing', async () => {
    ;(<jest.Mock>exists).mockImplementation((path: string) => path.endsWith('index.d.ts') && !path.includes('sub'))
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY, SUB_ENTRY]))
    const jobs = (<jest.Mock>runPrePass).mock.calls[0][0]
    expect(jobs).toHaveLength(1)
    expect(jobs[0].inputPath).toBe('/abs/dist/libs/foo/index.d.ts')
  })

  it('exits early when no entry has a tsc-emitted .d.ts', async () => {
    ;(<jest.Mock>exists).mockReturnValue(false)
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY]))
    expect(runPrePass).not.toHaveBeenCalled()
  })

  it('threads the optional memory monitor through to runPrePass', async () => {
    const monitor = { check: jest.fn() }
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY]), monitor as unknown as Parameters<typeof runDtsPerEntry>[1])
    expect((<jest.Mock>runPrePass).mock.calls[0][1].monitor).toBe(monitor)
    expect(monitor.check).toHaveBeenCalledWith('bundle:declarations:dts-perentry:start')
    expect(monitor.check).toHaveBeenCalledWith('bundle:declarations:dts-perentry:end')
  })

  it('threads npmDeps, workspaceRoutes, and depsRoot into every per-entry job', async () => {
    const ctx = makeContext(['rollup', 'postject'], [ROOT_ENTRY, SUB_ENTRY])
    ctx.workspaceBundledDeps = [
      {
        packageName: '@hyperfrontend/logging',
        specifier: '@hyperfrontend/logging',
        subPath: '',
        policy: 'whole-surface',
        inputPath: '/abs/repo/libs/logging/src/index.ts',
        tsConfigPath: '/abs/repo/libs/logging/tsconfig.lib.json',
      },
      {
        packageName: '@hyperfrontend/iau',
        specifier: '@hyperfrontend/iau/a',
        subPath: 'a',
        policy: 'sub-path',
        inputPath: '/abs/repo/libs/iau/src/a/index.ts',
        tsConfigPath: '/abs/repo/libs/iau/tsconfig.lib.json',
      },
    ]
    await runDtsPerEntry(ctx)
    const jobs = (<jest.Mock>runPrePass).mock.calls[0][0]
    expect(jobs).toHaveLength(2)
    for (const job of jobs) {
      expect(job.depsRoot).toBe('/abs/dist/libs/foo/_dependencies')
      expect(job.npmDeps).toEqual(['rollup', 'postject'])
      expect(job.workspaceRoutes).toEqual([
        { packageName: '@hyperfrontend/logging', policy: 'whole-surface' },
        { packageName: '@hyperfrontend/iau', policy: 'sub-path', specifiers: ['@hyperfrontend/iau/a'] },
      ])
    }
  })
})
