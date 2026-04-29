jest.mock('@hyperfrontend/project-scope/core', () => {
  const actual = jest.requireActual('@hyperfrontend/project-scope/core')
  return { ...actual, ensureDir: jest.fn(), writeJsonFile: jest.fn() }
})
jest.mock('./codesign', () => ({ removeCodesign: jest.fn() }))
jest.mock('./host-binary', () => ({ resolveHostBinary: jest.fn() }))
jest.mock('./inject', () => ({ injectBlob: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./platform-check', () => ({
  currentPlatformMatches: jest.fn(),
  currentPlatformTarget: jest.fn(),
}))
jest.mock('./sea-blob', () => ({ generateSeaBlob: jest.fn() }))
jest.mock('./sea-config', () => ({ generateSeaConfig: jest.fn() }))

import type { BinConfig, BuildContext } from '../../models'
import { ensureDir, writeJsonFile } from '@hyperfrontend/project-scope/core'
import { buildNativeBin } from './build-native'
import { removeCodesign } from './codesign'
import { resolveHostBinary } from './host-binary'
import { injectBlob } from './inject'
import { currentPlatformMatches, currentPlatformTarget } from './platform-check'
import { generateSeaBlob } from './sea-blob'
import { generateSeaConfig } from './sea-config'

const makeContext = (): BuildContext => ({
  projectRoot: '/abs/libs/builder',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/builder',
  outputPath: '/abs/dist/libs/builder',
  tsConfigPath: '/abs/libs/builder/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: { category: 'root', entryPoints: [], hasRootEntry: false, platformEntries: [], featureEntries: [] },
  startedAt: 0,
})

const seaBin: BinConfig = { name: 'hf-build', format: 'cjs', sea: { platforms: ['linux-x64'] } }

beforeEach(() => {
  ;(<jest.Mock>ensureDir).mockReset()
  ;(<jest.Mock>writeJsonFile).mockReset()
  ;(<jest.Mock>removeCodesign).mockReset()
  ;(<jest.Mock>resolveHostBinary).mockReset().mockReturnValue('/opt/node')
  ;(<jest.Mock>injectBlob).mockReset().mockResolvedValue(undefined)
  ;(<jest.Mock>currentPlatformMatches).mockReset().mockReturnValue(true)
  ;(<jest.Mock>currentPlatformTarget).mockReset().mockReturnValue('linux-x64')
  ;(<jest.Mock>generateSeaBlob).mockReset().mockReturnValue({ blobPath: '', status: 0 })
  ;(<jest.Mock>generateSeaConfig).mockReset().mockReturnValue({ main: '', output: '', disableExperimentalSEAWarning: true })
})

describe('buildNativeBin', () => {
  it('throws when called for a bin that has no sea config', async () => {
    await expect(
      buildNativeBin({ bin: { name: 'plain', format: 'cjs' }, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/plain.js' })
    ).rejects.toThrow(/without a sea config/)
  })

  it('throws when the bin does not declare a CJS format', async () => {
    await expect(
      buildNativeBin({
        bin: { name: 'esm-only', format: 'esm', sea: { platforms: ['linux-x64'] } },
        ctx: makeContext(),
        cjsOutputPath: '/abs/dist/libs/builder/bin/esm-only.mjs',
      })
    ).rejects.toThrow(/SEA requires a CJS bin output/)
  })

  it('accepts a format array containing cjs', async () => {
    await expect(
      buildNativeBin({
        bin: { name: 'dual', format: ['esm', 'cjs'], sea: { platforms: ['linux-x64'] } },
        ctx: makeContext(),
        cjsOutputPath: '/abs/dist/libs/builder/bin/dual.cjs.js',
      })
    ).resolves.toBeDefined()
  })

  it('skips with an info log when the current platform does not match declared platforms', async () => {
    ;(<jest.Mock>currentPlatformMatches).mockReturnValueOnce(false)
    ;(<jest.Mock>currentPlatformTarget).mockReturnValueOnce('darwin-arm64')
    const result = await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(result).toEqual([])
    expect(ensureDir).not.toHaveBeenCalled()
    expect(injectBlob).not.toHaveBeenCalled()
  })

  it('ensures the bin directory exists before generating the SEA config', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(ensureDir).toHaveBeenCalledWith('/abs/dist/libs/builder/bin')
  })

  it('writes the SEA config JSON to <binDir>/<name>.sea-config.json', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(writeJsonFile).toHaveBeenCalledWith('/abs/dist/libs/builder/bin/hf-build.sea-config.json', expect.any(Object))
    expect(generateSeaConfig).toHaveBeenCalledWith({
      mainPath: '/abs/dist/libs/builder/bin/hf-build.js',
      outputPath: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
    })
  })

  it('runs generateSeaBlob with the resolved config and blob paths', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(generateSeaBlob).toHaveBeenCalledWith({
      seaConfigPath: '/abs/dist/libs/builder/bin/hf-build.sea-config.json',
      outputBlobPath: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
    })
  })

  it('resolves the host binary for the current target platform', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(resolveHostBinary).toHaveBeenCalledWith({ platform: 'linux-x64' })
  })

  it('injects the blob into a cloned host binary at the per-target output path', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(injectBlob).toHaveBeenCalledWith({
      hostBinary: '/opt/node',
      outputBinary: '/abs/dist/libs/builder/bin/hf-build.linux-x64',
      blobPath: '/abs/dist/libs/builder/bin/hf-build.sea-prep.blob',
    })
  })

  it('appends `.exe` for win32 platforms', async () => {
    ;(<jest.Mock>currentPlatformTarget).mockReturnValue('win32-x64')
    await buildNativeBin({
      bin: { name: 'hf-build', format: 'cjs', sea: { platforms: ['win32-x64'] } },
      ctx: makeContext(),
      cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js',
    })
    const call = (<jest.Mock>injectBlob).mock.calls[0][0]
    expect(call.outputBinary).toBe('/abs/dist/libs/builder/bin/hf-build.win32-x64.exe')
  })

  it('strips the macOS code signature after injection', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(removeCodesign).toHaveBeenCalledWith({ binary: '/abs/dist/libs/builder/bin/hf-build.linux-x64' })
  })

  it('returns a single native BinOutput for the current target', async () => {
    const result = await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(result).toEqual([
      {
        name: 'hf-build',
        kind: 'native',
        outputPath: '/abs/dist/libs/builder/bin/hf-build.linux-x64',
        platform: 'linux-x64',
      },
    ])
  })
})
