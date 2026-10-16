import type { Mock } from '@hyperfrontend/testing'
import type { BinConfig, BuildContext } from '../../models'
import { unlinkSync } from 'node:fs'
import { beforeEach } from 'node:test'
import { __mockChannel } from '@hyperfrontend/logging'
import { ensureDir, exists, writeJsonFile } from '@hyperfrontend/project-scope/core'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { buildNativeBin } from './build-native'
import { removeCodesign } from './codesign'
import { dispatchInjectWorker, resolveDefaultInjectWorkerPath } from './dispatch'
import { resolveHostBinary } from './host-binary'
import { NODE_SEA_FUSE, NODE_SEA_MACHO_SEGMENT, NODE_SEA_RESOURCE_NAME } from './inject'
import { currentPlatformMatches, currentPlatformTarget } from './platform-check'
import { generateSeaBlob } from './sea-blob'
import { generateSeaConfig } from './sea-config'
jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual('@hyperfrontend/logging')
  const mockChannel = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() }
  return {
    ...actual,
    logger: { channel: jest.fn(() => mockChannel) },
    __mockChannel: mockChannel,
  }
})
jest.mock('node:fs', () => ({ ...jest.requireActual('node:fs'), unlinkSync: jest.fn() }))
jest.mock('@hyperfrontend/project-scope/core', () => {
  const actual = jest.requireActual('@hyperfrontend/project-scope/core')
  return { ...actual, ensureDir: jest.fn(), writeJsonFile: jest.fn(), exists: jest.fn() }
})
jest.mock('./codesign', () => ({ removeCodesign: jest.fn() }))
jest.mock('./host-binary', () => ({ resolveHostBinary: jest.fn() }))
jest.mock('./dispatch', () => ({
  dispatchInjectWorker: jest.fn().mockResolvedValue({ outputSize: 138_000_000, endHeapMB: 220, endRssMB: 480, durationMs: 1234 }),
  resolveDefaultInjectWorkerPath: jest.fn(() => ({ path: '/abs/repo/dist/libs/builder/bin/native/worker/index.cjs', execArgv: [] })),
}))
jest.mock('./platform-check', () => ({
  currentPlatformMatches: jest.fn(),
  currentPlatformTarget: jest.fn(),
}))
jest.mock('./sea-blob', () => ({ generateSeaBlob: jest.fn() }))
jest.mock('./sea-config', () => ({ generateSeaConfig: jest.fn() }))

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
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

const seaBin: BinConfig = { name: 'hf-build', format: 'cjs', sea: { platforms: ['linux-x64'] } }

const mockChannel = __mockChannel as {
  error: Mock
  warn: Mock
  info: Mock
  debug: Mock
  log: Mock
}

beforeEach(() => {
  ;(ensureDir as Mock).mockReset()
  ;(writeJsonFile as Mock).mockReset()
  ;(exists as Mock).mockReset().mockReturnValue(true)
  ;(unlinkSync as Mock).mockReset()
  ;(removeCodesign as Mock).mockReset()
  ;(resolveHostBinary as Mock).mockReset().mockReturnValue('/opt/node')
  ;(dispatchInjectWorker as Mock)
    .mockReset()
    .mockResolvedValue({ outputSize: 138_000_000, endHeapMB: 220, endRssMB: 480, durationMs: 1234 })
  ;(resolveDefaultInjectWorkerPath as Mock).mockReset().mockReturnValue({
    path: '/abs/repo/dist/libs/builder/bin/native/worker/index.cjs',
    execArgv: [],
  })
  ;(currentPlatformMatches as Mock).mockReset().mockReturnValue(true)
  ;(currentPlatformTarget as Mock).mockReset().mockReturnValue('linux-x64')
  ;(generateSeaBlob as Mock).mockReset().mockReturnValue({ blobPath: '', status: 0 })
  ;(generateSeaConfig as Mock).mockReset().mockReturnValue({ main: '', output: '', disableExperimentalSEAWarning: true })
  mockChannel.error.mockReset()
  mockChannel.warn.mockReset()
  mockChannel.info.mockReset()
  mockChannel.debug.mockReset()
  mockChannel.log.mockReset()
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
        cjsOutputPath: '/abs/dist/libs/builder/bin/dual.cjs',
      })
    ).resolves.toBeDefined()
  })

  const buildOnMismatchedPlatform = (): ReturnType<typeof buildNativeBin> => {
    ;(currentPlatformMatches as Mock).mockReturnValueOnce(false)
    ;(currentPlatformTarget as Mock).mockReturnValueOnce('darwin-arm64')
    return buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
  }

  it('returns no outputs when the current platform does not match the declared platforms', async () => {
    expect(await buildOnMismatchedPlatform()).toEqual([])
  })

  it('creates no bin directory when the current platform does not match the declared platforms', async () => {
    await buildOnMismatchedPlatform()
    expect(ensureDir).not.toHaveBeenCalled()
  })

  it('dispatches no inject worker when the current platform does not match the declared platforms', async () => {
    await buildOnMismatchedPlatform()
    expect(dispatchInjectWorker).not.toHaveBeenCalled()
  })

  it('ensures the bin directory exists before generating the SEA config', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(ensureDir).toHaveBeenCalledWith(normalizeToNative('/abs/dist/libs/builder/bin'))
  })

  it('generates the SEA config from the CJS output path and the prep-blob path', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(generateSeaConfig).toHaveBeenCalledWith({
      mainPath: '/abs/dist/libs/builder/bin/hf-build.js',
      outputPath: normalizeToNative('/abs/dist/libs/builder/bin/hf-build.sea-prep.blob'),
    })
  })

  it('writes the SEA config JSON to <binDir>/<name>.sea-config.json', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(writeJsonFile).toHaveBeenCalledWith(normalizeToNative('/abs/dist/libs/builder/bin/hf-build.sea-config.json'), expect.any(Object))
  })

  it('runs generateSeaBlob with the resolved config and blob paths', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(generateSeaBlob).toHaveBeenCalledWith({
      seaConfigPath: normalizeToNative('/abs/dist/libs/builder/bin/hf-build.sea-config.json'),
      outputBlobPath: normalizeToNative('/abs/dist/libs/builder/bin/hf-build.sea-prep.blob'),
    })
  })

  it('resolves the host binary for the current target platform', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(resolveHostBinary).toHaveBeenCalledWith({ platform: 'linux-x64' })
  })

  it('resolves the inject worker against the workspace root before dispatching', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(resolveDefaultInjectWorkerPath).toHaveBeenCalledWith('/abs/repo')
  })

  it('throws when the inject worker cannot be resolved', async () => {
    ;(resolveDefaultInjectWorkerPath as Mock).mockReturnValueOnce(undefined)
    await expect(
      buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    ).rejects.toThrow(/inject worker could not be resolved/)
  })

  it('dispatches no inject worker when the worker cannot be resolved', async () => {
    ;(resolveDefaultInjectWorkerPath as Mock).mockReturnValueOnce(undefined)
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' }).catch(
      () => undefined
    )
    expect(dispatchInjectWorker).not.toHaveBeenCalled()
  })

  it('dispatches the inject worker with the resolved SEA constants and host/output paths', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(dispatchInjectWorker).toHaveBeenCalledWith(
      {
        hostBinary: '/opt/node',
        outputBinary: normalizeToNative('/abs/dist/libs/builder/bin/hf-build.linux-x64'),
        blobPath: normalizeToNative('/abs/dist/libs/builder/bin/hf-build.sea-prep.blob'),
        resourceName: NODE_SEA_RESOURCE_NAME,
        machoSegmentName: NODE_SEA_MACHO_SEGMENT,
        sentinelFuse: NODE_SEA_FUSE,
        reportPath: '',
      },
      expect.objectContaining({
        workerPath: '/abs/repo/dist/libs/builder/bin/native/worker/index.cjs',
        execArgv: [],
        label: 'hf-build',
      })
    )
  })

  it('threads execArgv from the source-mode resolution into the dispatch options', async () => {
    ;(resolveDefaultInjectWorkerPath as Mock).mockReturnValueOnce({
      path: '/abs/repo/libs/builder/src/bin/native/worker/index.ts',
      execArgv: ['--require', '@swc-node/register'],
    })
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(dispatchInjectWorker).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workerPath: '/abs/repo/libs/builder/src/bin/native/worker/index.ts',
        execArgv: ['--require', '@swc-node/register'],
      })
    )
  })

  it('appends `.exe` for win32 platforms', async () => {
    ;(currentPlatformTarget as Mock).mockReturnValue('win32-x64')
    await buildNativeBin({
      bin: { name: 'hf-build', format: 'cjs', sea: { platforms: ['win32-x64'] } },
      ctx: makeContext(),
      cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js',
    })
    const call = (dispatchInjectWorker as Mock).mock.calls[0][0]
    expect(call.outputBinary).toBe(normalizeToNative('/abs/dist/libs/builder/bin/hf-build.win32-x64.exe'))
  })

  it('strips the macOS code signature after injection', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(removeCodesign).toHaveBeenCalledWith({ binary: normalizeToNative('/abs/dist/libs/builder/bin/hf-build.linux-x64') })
  })

  it('deletes the SEA config JSON and prep blob intermediates after the binary is produced', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect((unlinkSync as Mock).mock.calls).toEqual([
      [normalizeToNative('/abs/dist/libs/builder/bin/hf-build.sea-config.json')],
      [normalizeToNative('/abs/dist/libs/builder/bin/hf-build.sea-prep.blob')],
    ])
  })

  it('skips deleting SEA intermediates that are absent from disk', async () => {
    ;(exists as Mock).mockReturnValue(false)
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(unlinkSync).not.toHaveBeenCalled()
  })

  it('returns a single native BinOutput for the current target', async () => {
    const result = await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(result).toEqual([
      {
        name: 'hf-build',
        kind: 'native',
        outputPath: normalizeToNative('/abs/dist/libs/builder/bin/hf-build.linux-x64'),
        platform: 'linux-x64',
      },
    ])
  })

  it('emits a memory snapshot before each pipeline step', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(mockChannel.debug.mock.calls.map(([line]) => line)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^hf-build: pre-sea-config: heap=[\d.]+MB rss=[\d.]+MB free=[\d.]+MB$/),
        expect.stringMatching(/^hf-build: pre-sea-blob: heap=[\d.]+MB rss=[\d.]+MB free=[\d.]+MB$/),
        expect.stringMatching(/^hf-build: pre-inject \(host=\/opt\/node\): heap=[\d.]+MB rss=[\d.]+MB free=[\d.]+MB$/),
        expect.stringMatching(/^hf-build: post-inject: heap=[\d.]+MB rss=[\d.]+MB free=[\d.]+MB$/),
        expect.stringMatching(/^hf-build: native build complete: heap=[\d.]+MB rss=[\d.]+MB free=[\d.]+MB$/),
      ])
    )
  })

  it('logs the sea blob duration at debug level', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(mockChannel.debug).toHaveBeenCalledWith(expect.stringMatching(/^hf-build: sea blob generated in \d+ms$/))
  })

  it('logs the inject duration with the worker end metrics at debug level', async () => {
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })
    expect(mockChannel.debug).toHaveBeenCalledWith('hf-build: inject completed in 1234ms (worker end heap=220.0MB rss=480.0MB)')
  })

  it('re-throws when dispatchInjectWorker rejects with an Error', async () => {
    const failure = new Error('worker boom')
    ;(dispatchInjectWorker as Mock).mockRejectedValueOnce(failure)
    await expect(buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })).rejects.toBe(
      failure
    )
  })

  it('logs the inject failure when dispatchInjectWorker rejects with an Error', async () => {
    ;(dispatchInjectWorker as Mock).mockRejectedValueOnce(new Error('worker boom'))
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' }).catch(
      () => undefined
    )
    expect(mockChannel.error).toHaveBeenCalledWith('hf-build: postject inject failed: worker boom')
  })

  it('re-throws a non-Error dispatchInjectWorker rejection as-is', async () => {
    ;(dispatchInjectWorker as Mock).mockRejectedValueOnce('not-an-error')
    await expect(buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' })).rejects.toBe(
      'not-an-error'
    )
  })

  it('formats non-Error dispatchInjectWorker rejections via String() in the error log', async () => {
    ;(dispatchInjectWorker as Mock).mockRejectedValueOnce('not-an-error')
    await buildNativeBin({ bin: seaBin, ctx: makeContext(), cjsOutputPath: '/abs/dist/libs/builder/bin/hf-build.js' }).catch(
      () => undefined
    )
    expect(mockChannel.error).toHaveBeenCalledWith('hf-build: postject inject failed: not-an-error')
  })
})
