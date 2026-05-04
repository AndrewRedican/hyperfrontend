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
})
