import type { BinConfig, BinOutput, BuildContext } from '../models'
import { buildNativeBin } from './native/build-native'
import { runBinPhase } from './run-bin-phase'
import { buildJsBin } from './script/build-bin'
jest.mock('./script/build-bin', () => ({ buildJsBin: jest.fn() }))
jest.mock('./native/build-native', () => ({ buildNativeBin: jest.fn() }))

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
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

beforeEach(() => {
  ;(<jest.Mock>buildJsBin).mockReset()
  ;(<jest.Mock>buildNativeBin).mockReset().mockResolvedValue([])
})

describe('runBinPhase', () => {
  it('returns an empty array when no bins are declared', async () => {
    const result = await runBinPhase(makeContext(), [])
    expect(result).toEqual([])
    expect(buildJsBin).not.toHaveBeenCalled()
    expect(buildNativeBin).not.toHaveBeenCalled()
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

  it('skips buildNativeBin for bins without a sea config', async () => {
    ;(<jest.Mock>buildJsBin).mockResolvedValueOnce([{ name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/cz.js' }])
    await runBinPhase(makeContext(), <BinConfig[]>[{ name: 'cz', format: 'cjs' }])
    expect(buildNativeBin).not.toHaveBeenCalled()
  })

  it('runs buildNativeBin for bins with a sea config and forwards the CJS output path', async () => {
    const cjs: BinOutput = { name: 'hf-build', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/hf-build.js' }
    ;(<jest.Mock>buildJsBin).mockResolvedValueOnce([cjs])
    const ctx = makeContext()
    const bin: BinConfig = { name: 'hf-build', format: 'cjs', sea: { platforms: ['linux-x64'] } }
    await runBinPhase(ctx, [bin])
    expect(buildNativeBin).toHaveBeenCalledWith({ bin, ctx, cjsOutputPath: '/abs/dist/libs/foo/bin/hf-build.js' })
  })

  it('aggregates native outputs alongside JS outputs', async () => {
    const cjs: BinOutput = { name: 'hf-build', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/hf-build.js' }
    const native: BinOutput = {
      name: 'hf-build',
      kind: 'native',
      outputPath: '/abs/dist/libs/foo/bin/hf-build.linux-x64',
      platform: 'linux-x64',
    }
    ;(<jest.Mock>buildJsBin).mockResolvedValueOnce([cjs])
    ;(<jest.Mock>buildNativeBin).mockResolvedValueOnce([native])
    const result = await runBinPhase(makeContext(), <BinConfig[]>[{ name: 'hf-build', format: 'cjs', sea: { platforms: ['linux-x64'] } }])
    expect(result).toEqual([cjs, native])
  })

  it('throws when a sea-enabled bin has no CJS output (defense in depth)', async () => {
    ;(<jest.Mock>buildJsBin).mockResolvedValueOnce([{ name: 'hf-build', kind: 'esm', outputPath: '/abs/dist/libs/foo/bin/hf-build.mjs' }])
    await expect(
      runBinPhase(makeContext(), <BinConfig[]>[{ name: 'hf-build', format: 'esm', sea: { platforms: ['linux-x64'] } }])
    ).rejects.toThrow(/SEA requires a CJS bin output/)
    expect(buildNativeBin).not.toHaveBeenCalled()
  })

  it('emits no native outputs when buildNativeBin returns [] (platform skip)', async () => {
    const cjs: BinOutput = { name: 'hf-build', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/hf-build.js' }
    ;(<jest.Mock>buildJsBin).mockResolvedValueOnce([cjs])
    ;(<jest.Mock>buildNativeBin).mockResolvedValueOnce([])
    const result = await runBinPhase(makeContext(), <BinConfig[]>[
      { name: 'hf-build', format: 'cjs', sea: { platforms: ['darwin-arm64'] } },
    ])
    expect(result).toEqual([cjs])
  })
})
