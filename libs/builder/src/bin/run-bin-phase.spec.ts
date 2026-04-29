jest.mock('./script/build-bin', () => ({ buildJsBin: jest.fn() }))

import type { BinConfig, BinOutput, BuildContext } from '../models'
import { runBinPhase } from './run-bin-phase'
import { buildJsBin } from './script/build-bin'

const makeContext = (): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: { category: 'root', entryPoints: [], hasRootEntry: false, platformEntries: [], featureEntries: [] },
  startedAt: 0,
})

beforeEach(() => {
  ;(<jest.Mock>buildJsBin).mockReset()
})

describe('runBinPhase', () => {
  it('returns an empty array when no bins are declared', async () => {
    const result = await runBinPhase(makeContext(), [])
    expect(result).toEqual([])
    expect(buildJsBin).not.toHaveBeenCalled()
  })

  it('invokes buildJsBin once per declared bin', async () => {
    ;(<jest.Mock>buildJsBin).mockResolvedValue([])
    await runBinPhase(makeContext(), <BinConfig[]>[
      { name: 'cz', format: 'cjs' },
      { name: 'cl', format: 'cjs' },
    ])
    expect(buildJsBin).toHaveBeenCalledTimes(2)
  })

  it('aggregates outputs from every bin in declaration order', async () => {
    const czOut: BinOutput = { name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/cz.js' }
    const clOut: BinOutput = { name: 'cl', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/cl.js' }
    ;(<jest.Mock>buildJsBin).mockResolvedValueOnce([czOut]).mockResolvedValueOnce([clOut])
    const result = await runBinPhase(makeContext(), <BinConfig[]>[
      { name: 'cz', format: 'cjs' },
      { name: 'cl', format: 'cjs' },
    ])
    expect(result).toEqual([czOut, clOut])
  })

  it('flattens multi-format output arrays returned by buildJsBin', async () => {
    const cjs: BinOutput = { name: 'hf', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/hf.cjs.js' }
    const esm: BinOutput = { name: 'hf', kind: 'esm', outputPath: '/abs/dist/libs/foo/bin/hf.mjs' }
    ;(<jest.Mock>buildJsBin).mockResolvedValueOnce([cjs, esm])
    const result = await runBinPhase(makeContext(), <BinConfig[]>[{ name: 'hf', format: ['cjs', 'esm'] }])
    expect(result).toEqual([cjs, esm])
  })

  it('forwards the resolved BuildContext to each buildJsBin invocation', async () => {
    ;(<jest.Mock>buildJsBin).mockResolvedValue([])
    const ctx = makeContext()
    const bin: BinConfig = { name: 'cz', format: 'cjs' }
    await runBinPhase(ctx, [bin])
    expect(buildJsBin).toHaveBeenCalledWith(bin, ctx)
  })
})
