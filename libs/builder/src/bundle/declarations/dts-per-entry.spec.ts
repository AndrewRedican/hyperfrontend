import type { Mock } from '@hyperfrontend/testing'
import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../models'
import { beforeEach } from 'node:test'
import { exists } from '@hyperfrontend/project-scope/core/fs'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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
  ;(runPrePass as Mock).mockClear()
  ;(resolveDefaultWorkerPath as Mock)
    .mockReset()
    .mockReturnValue({ path: '/abs/dist/libs/builder/bundle/dependencies/worker/index.cjs', execArgv: [] })
  ;(exists as Mock).mockReset().mockReturnValue(true)
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
    expect((runPrePass as Mock).mock.calls.map(([jobs]) => jobs)).toEqual([
      [expect.objectContaining({ inputPath: '/abs/dist/libs/foo/index.d.ts' })],
    ])
  })

  it('throws a context-rich error when the worker artifact is missing', async () => {
    ;(resolveDefaultWorkerPath as Mock).mockReturnValueOnce(undefined)
    await expect(runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY]))).rejects.toThrow(
      /worker could not be located beside the builder module/
    )
  })

  it('builds one dts job per entry whose tsc-emitted .d.ts exists', async () => {
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY, SUB_ENTRY]))
    expect((runPrePass as Mock).mock.calls.map(([jobs]) => jobs)).toEqual([
      [
        expect.objectContaining({ kind: 'dts', inputPath: '/abs/dist/libs/foo/index.d.ts', otherDeps: expect.arrayContaining(['rollup']) }),
        expect.objectContaining({
          kind: 'dts',
          inputPath: '/abs/dist/libs/foo/sub/index.d.ts',
          otherDeps: expect.arrayContaining(['rollup']),
        }),
      ],
    ])
  })

  it('threads sibling-entry descriptors and selfDtsPath into each job', async () => {
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY, SUB_ENTRY]))
    expect((runPrePass as Mock).mock.calls[0][0]).toEqual([
      expect.objectContaining({
        selfDtsPath: '/abs/dist/libs/foo/index.d.ts',
        selfSrcPath: '',
        siblingEntries: [{ srcPath: 'sub', indexDtsPath: '/abs/dist/libs/foo/sub/index.d.ts' }],
      }),
      expect.objectContaining({
        selfDtsPath: '/abs/dist/libs/foo/sub/index.d.ts',
        siblingEntries: [{ srcPath: '', indexDtsPath: '/abs/dist/libs/foo/index.d.ts' }],
      }),
    ])
  })

  it('skips entries whose tsc output is missing', async () => {
    ;(exists as Mock).mockImplementation((path: string) => path.endsWith('index.d.ts') && !path.includes('sub'))
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY, SUB_ENTRY]))
    expect((runPrePass as Mock).mock.calls[0][0]).toEqual([expect.objectContaining({ inputPath: '/abs/dist/libs/foo/index.d.ts' })])
  })

  it('exits early when no entry has a tsc-emitted .d.ts', async () => {
    ;(exists as Mock).mockReturnValue(false)
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY]))
    expect(runPrePass).not.toHaveBeenCalled()
  })

  it('threads the optional memory monitor through to runPrePass', async () => {
    const monitor = { check: jest.fn() }
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY]), monitor as unknown as Parameters<typeof runDtsPerEntry>[1])
    expect((runPrePass as Mock).mock.calls[0][1].monitor).toBe(monitor)
  })

  it('checkpoints the monitor at the start and end of the per-entry pass', async () => {
    const monitor = { check: jest.fn() }
    await runDtsPerEntry(makeContext(['rollup'], [ROOT_ENTRY]), monitor as unknown as Parameters<typeof runDtsPerEntry>[1])
    expect(monitor.check.mock.calls).toEqual([['bundle:declarations:dts-perentry:start'], ['bundle:declarations:dts-perentry:end']])
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
    const routing = expect.objectContaining({
      depsRoot: normalizeToNative('/abs/dist/libs/foo/_dependencies'),
      npmDeps: ['rollup', 'postject'],
      workspaceRoutes: [
        { packageName: '@hyperfrontend/logging', policy: 'whole-surface' },
        { packageName: '@hyperfrontend/iau', policy: 'sub-path', specifiers: ['@hyperfrontend/iau/a'] },
      ],
    })
    expect((runPrePass as Mock).mock.calls[0][0]).toEqual([routing, routing])
  })
})
