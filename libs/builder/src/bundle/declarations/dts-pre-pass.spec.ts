import type { Mock } from '@hyperfrontend/testing'
import type { BuildContext, EntryPointDiscovery } from '../../models'
import { beforeEach } from 'node:test'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { resolveDefaultWorkerPath, runPrePass } from '../dependencies/pre-pass'
import { runDtsPrePass } from './dts-pre-pass'
jest.mock('../dependencies/pre-pass', () => ({
  runPrePass: jest.fn().mockResolvedValue([]),
  resolveDefaultWorkerPath: jest.fn(),
}))
jest.mock('../dependencies/resolve-dep-entry', () => ({
  resolveDepEntry: jest.fn().mockReturnValue('/abs/repo/node_modules/<dep>/index.d.ts'),
}))
jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return { ...actual, logger: { channel: jest.fn(() => mockChannel) } }
})

const DISCOVERY: EntryPointDiscovery = { category: 'root', entryPoints: [], hasRootEntry: false, platformEntries: [], featureEntries: [] }

const makeContext = (bundledDeps: string[]): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: DISCOVERY,
  bundledDeps,
  workspaceBundledDeps: [],
  startedAt: 0,
})

beforeEach(() => {
  ;(runPrePass as Mock).mockClear()
  ;(resolveDefaultWorkerPath as Mock)
    .mockReset()
    .mockReturnValue({ path: '/abs/dist/libs/builder/bundle/dependencies/worker/index.cjs', execArgv: [] })
})

describe('runDtsPrePass', () => {
  it('is a no-op when no bundled deps are configured', async () => {
    await runDtsPrePass(makeContext([]))
    expect(runPrePass).not.toHaveBeenCalled()
  })

  it('throws a context-rich error when the worker artifact is missing', async () => {
    ;(resolveDefaultWorkerPath as Mock).mockReturnValueOnce(undefined)
    await expect(runDtsPrePass(makeContext(['rollup']))).rejects.toThrow(/worker could not be located beside the builder module/)
  })

  it('builds one dts job per bundled dep and forwards them to runPrePass', async () => {
    await runDtsPrePass(makeContext(['rollup', 'postject']))
    expect((runPrePass as Mock).mock.calls).toEqual([
      [
        [
          expect.objectContaining({
            kind: 'dts',
            format: 'esm',
            outputPath: normalizeToNative('/abs/dist/libs/foo/_dependencies/rollup/index.d.ts'),
            otherDeps: ['postject'],
          }),
          expect.objectContaining({
            kind: 'dts',
            format: 'esm',
            outputPath: normalizeToNative('/abs/dist/libs/foo/_dependencies/postject/index.d.ts'),
            otherDeps: ['rollup'],
          }),
        ],
        expect.objectContaining({ workerPath: '/abs/dist/libs/builder/bundle/dependencies/worker/index.cjs' }),
      ],
    ])
  })

  it('threads the optional memory monitor through to runPrePass', async () => {
    const monitor = { check: jest.fn() }
    await runDtsPrePass(makeContext(['rollup']), monitor as unknown as Parameters<typeof runDtsPrePass>[1])
    expect((runPrePass as Mock).mock.calls[0][1].monitor).toBe(monitor)
  })

  it('checkpoints the monitor at the start and end of the pre-pass', async () => {
    const monitor = { check: jest.fn() }
    await runDtsPrePass(makeContext(['rollup']), monitor as unknown as Parameters<typeof runDtsPrePass>[1])
    expect(monitor.check.mock.calls).toEqual([['bundle:declarations:dts-prepass:start'], ['bundle:declarations:dts-prepass:end']])
  })

  it('threads npmDeps, workspaceRoutes, and depsRoot through to npm dts jobs', async () => {
    const ctx = makeContext(['rollup', 'postject'])
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
    await runDtsPrePass(ctx)
    const npmJobs = (runPrePass as Mock).mock.calls[0][0].filter((job: { kind: string }) => job.kind === 'dts')
    expect(npmJobs).toEqual([
      expect.objectContaining({
        depsRoot: normalizeToNative('/abs/dist/libs/foo/_dependencies'),
        npmDeps: ['postject'],
        workspaceRoutes: [{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }],
      }),
      expect.objectContaining({ npmDeps: ['rollup'] }),
    ])
  })

  it('threads workspace-dts jobs with self-package excluded from workspaceRoutes', async () => {
    const ctx = makeContext([])
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
        packageName: '@hyperfrontend/project-scope',
        specifier: '@hyperfrontend/project-scope',
        subPath: '',
        policy: 'whole-surface',
        inputPath: '/abs/repo/libs/project-scope/src/index.ts',
        tsConfigPath: '/abs/repo/libs/project-scope/tsconfig.lib.json',
      },
    ]
    await runDtsPrePass(ctx)
    expect((runPrePass as Mock).mock.calls[0][0]).toEqual([
      expect.objectContaining({
        kind: 'workspace-dts',
        dep: '@hyperfrontend/logging',
        depsRoot: normalizeToNative('/abs/dist/libs/foo/_dependencies'),
        npmDeps: [],
        workspaceRoutes: [{ packageName: '@hyperfrontend/project-scope', policy: 'whole-surface' }],
      }),
      expect.objectContaining({
        dep: '@hyperfrontend/project-scope',
        workspaceRoutes: [{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }],
      }),
    ])
  })

  it('excludes only the self specifier (not the whole package) when workspace dep policy is sub-path', async () => {
    const ctx = makeContext([])
    ctx.workspaceBundledDeps = [
      {
        packageName: '@hyperfrontend/iau',
        specifier: '@hyperfrontend/iau/a',
        subPath: 'a',
        policy: 'sub-path',
        inputPath: '/abs/repo/libs/iau/src/a/index.ts',
        tsConfigPath: '/abs/repo/libs/iau/tsconfig.lib.json',
      },
      {
        packageName: '@hyperfrontend/iau',
        specifier: '@hyperfrontend/iau/b',
        subPath: 'b',
        policy: 'sub-path',
        inputPath: '/abs/repo/libs/iau/src/b/index.ts',
        tsConfigPath: '/abs/repo/libs/iau/tsconfig.lib.json',
      },
    ]
    await runDtsPrePass(ctx)
    expect((runPrePass as Mock).mock.calls[0][0]).toEqual([
      expect.objectContaining({
        dep: '@hyperfrontend/iau/a',
        workspaceRoutes: [{ packageName: '@hyperfrontend/iau', policy: 'sub-path', specifiers: ['@hyperfrontend/iau/b'] }],
      }),
      expect.objectContaining({
        workspaceRoutes: [{ packageName: '@hyperfrontend/iau', policy: 'sub-path', specifiers: ['@hyperfrontend/iau/a'] }],
      }),
    ])
  })
})
