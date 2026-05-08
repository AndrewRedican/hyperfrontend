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

import type { BuildContext, EntryPointDiscovery } from '../../models'
import { resolveDefaultWorkerPath, runPrePass } from '../dependencies/pre-pass'
import { runDtsPrePass } from './dts-pre-pass'

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
  ;(<jest.Mock>runPrePass).mockClear()
  ;(<jest.Mock>resolveDefaultWorkerPath)
    .mockReset()
    .mockReturnValue({ path: '/abs/dist/libs/builder/bundle/dependencies/worker/index.cjs.js', execArgv: [] })
})

describe('runDtsPrePass', () => {
  it('is a no-op when no bundled deps are configured', async () => {
    await runDtsPrePass(makeContext([]))
    expect(runPrePass).not.toHaveBeenCalled()
  })

  it('throws a context-rich error when the worker artifact is missing', async () => {
    ;(<jest.Mock>resolveDefaultWorkerPath).mockReturnValueOnce(undefined)
    await expect(runDtsPrePass(makeContext(['rollup']))).rejects.toThrow(/worker artifact was not found/)
  })

  it('builds one dts job per bundled dep and forwards them to runPrePass', async () => {
    await runDtsPrePass(makeContext(['rollup', 'postject']))
    expect(runPrePass).toHaveBeenCalledTimes(1)
    const [jobs, options] = (<jest.Mock>runPrePass).mock.calls[0]
    expect(jobs).toHaveLength(2)
    expect(jobs.every((j: { kind: string; format: string }) => j.kind === 'dts' && j.format === 'esm')).toBe(true)
    expect(jobs[0].outputPath).toMatch(/_dependencies\/rollup\/index\.d\.ts$/)
    expect(jobs[1].outputPath).toMatch(/_dependencies\/postject\/index\.d\.ts$/)
    expect(jobs[0].otherDeps).toEqual(['postject'])
    expect(jobs[1].otherDeps).toEqual(['rollup'])
    expect(options.workerPath).toBe('/abs/dist/libs/builder/bundle/dependencies/worker/index.cjs.js')
  })

  it('threads the optional memory monitor through to runPrePass', async () => {
    const monitor = { check: jest.fn() }
    await runDtsPrePass(makeContext(['rollup']), monitor as Parameters<typeof runDtsPrePass>[1])
    expect((<jest.Mock>runPrePass).mock.calls[0][1].monitor).toBe(monitor)
    expect(monitor.check).toHaveBeenCalledWith('bundle:declarations:dts-prepass:start')
    expect(monitor.check).toHaveBeenCalledWith('bundle:declarations:dts-prepass:end')
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
    const jobs = (<jest.Mock>runPrePass).mock.calls[0][0]
    expect(jobs[0].depsRoot).toBe('/abs/dist/libs/foo/_dependencies')
    expect(jobs[0].npmDeps).toEqual(['postject'])
    expect(jobs[0].workspaceRoutes).toEqual([{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }])
    expect(jobs[1].npmDeps).toEqual(['rollup'])
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
    const jobs = (<jest.Mock>runPrePass).mock.calls[0][0]
    expect(jobs).toHaveLength(2)
    expect(jobs[0].kind).toBe('workspace-dts')
    expect(jobs[0].dep).toBe('@hyperfrontend/logging')
    expect(jobs[0].depsRoot).toBe('/abs/dist/libs/foo/_dependencies')
    expect(jobs[0].npmDeps).toEqual([])
    expect(jobs[0].workspaceRoutes).toEqual([{ packageName: '@hyperfrontend/project-scope', policy: 'whole-surface' }])
    expect(jobs[1].dep).toBe('@hyperfrontend/project-scope')
    expect(jobs[1].workspaceRoutes).toEqual([{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }])
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
    const jobs = (<jest.Mock>runPrePass).mock.calls[0][0]
    expect(jobs).toHaveLength(2)
    expect(jobs[0].dep).toBe('@hyperfrontend/iau/a')
    expect(jobs[0].workspaceRoutes).toEqual([
      { packageName: '@hyperfrontend/iau', policy: 'sub-path', specifiers: ['@hyperfrontend/iau/b'] },
    ])
    expect(jobs[1].workspaceRoutes).toEqual([
      { packageName: '@hyperfrontend/iau', policy: 'sub-path', specifiers: ['@hyperfrontend/iau/a'] },
    ])
  })
})
