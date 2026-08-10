import type { MemoryMonitor } from './memory/monitor'
import type { BinConfig, BinOutput, BuildConfig, EntryPoint, EntryPointDiscovery, FormatOutputs } from './models'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as nodeJoin } from 'node:path'
import { logger } from '@hyperfrontend/logging'
import { runBinPhase } from './bin/run-bin-phase'
import { build, createBuildContext } from './build'
import { discoverEntries } from './bundle/entries/discover-entries'
import { runBundlePhase } from './bundle/run-bundle-phase'
import { createMemoryMonitor } from './memory/monitor'
import { finalizeFilesAllowlist } from './package/finalize-files'
import { runPackagePhase } from './package/run-package-phase'
jest.mock('./bundle/run-bundle-phase', () => ({ runBundlePhase: jest.fn() }))
jest.mock('./package/run-package-phase', () => ({ runPackagePhase: jest.fn() }))
jest.mock('./package/finalize-files', () => ({ finalizeFilesAllowlist: jest.fn() }))
jest.mock('./bin/run-bin-phase', () => ({ runBinPhase: jest.fn() }))
jest.mock('./bundle/entries/discover-entries', () => ({ discoverEntries: jest.fn() }))
jest.mock('./memory/monitor', () => ({ createMemoryMonitor: jest.fn() }))

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/repo/libs/foo/src/index.ts', isRoot: true }
const DISCOVERY: EntryPointDiscovery = {
  category: 'root',
  entryPoints: [ROOT_ENTRY],
  hasRootEntry: true,
  platformEntries: [],
  featureEntries: [],
}
const EMPTY_FORMATS: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }

const baseConfig = (): BuildConfig => ({ projectRoot: '/abs/repo/libs/foo', workspaceRoot: '/abs/repo' })

const makeMonitor = (): jest.Mocked<MemoryMonitor> => ({
  snapshot: jest.fn(),
  check: jest.fn(),
  logDebug: jest.fn(),
  logSummary: jest.fn(),
  getSnapshots: jest.fn().mockReturnValue([]),
})

beforeEach(() => {
  ;(<jest.Mock>discoverEntries).mockReset().mockReturnValue(DISCOVERY)
  ;(<jest.Mock>runBundlePhase).mockReset().mockResolvedValue(EMPTY_FORMATS)
  ;(<jest.Mock>runPackagePhase).mockReset().mockResolvedValue(undefined)
  ;(<jest.Mock>finalizeFilesAllowlist).mockReset()
  ;(<jest.Mock>runBinPhase).mockReset().mockResolvedValue([])
  ;(<jest.Mock>createMemoryMonitor).mockReset()
})

describe('createBuildContext', () => {
  it('resolves the project relative path against the workspace root', () => {
    const ctx = createBuildContext(baseConfig())
    expect(ctx.projectRelativePath).toBe('libs/foo')
  })

  it('defaults outputPath to <workspaceRoot>/dist/<projectRelativePath>', () => {
    const ctx = createBuildContext(baseConfig())
    expect(ctx.outputPath).toBe('/abs/repo/dist/libs/foo')
  })

  it('honors an explicit outputPath override', () => {
    const ctx = createBuildContext({ ...baseConfig(), outputPath: '/abs/custom/out' })
    expect(ctx.outputPath).toBe('/abs/custom/out')
  })

  it('defaults tsConfigPath to <projectRoot>/tsconfig.lib.json', () => {
    const ctx = createBuildContext(baseConfig())
    expect(ctx.tsConfigPath).toBe('/abs/repo/libs/foo/tsconfig.lib.json')
  })

  it('leaves the declaration map unset so the declaration pass keeps emitting one', () => {
    expect(createBuildContext(baseConfig()).declarationMap).toBeUndefined()
  })

  it('carries a declaration-map opt-out onto the context', () => {
    expect(createBuildContext({ ...baseConfig(), declarationMap: false }).declarationMap).toBe(false)
  })

  it('honors an explicit tsConfig override', () => {
    const ctx = createBuildContext({ ...baseConfig(), tsConfig: '/abs/custom/tsconfig.json' })
    expect(ctx.tsConfigPath).toBe('/abs/custom/tsconfig.json')
  })

  it('defaults external and assets to empty arrays', () => {
    const ctx = createBuildContext(baseConfig())
    expect(ctx.external).toEqual([])
    expect(ctx.assets).toEqual([])
  })

  it('threads through configured external and asset specs verbatim', () => {
    const assets = [{ from: '/abs/repo/libs/foo', files: ['README.md'] }]
    const ctx = createBuildContext({ ...baseConfig(), external: ['rollup'], assets })
    expect(ctx.external).toEqual(['rollup'])
    expect(ctx.assets).toBe(assets)
  })

  it('defaults isWorkspacePackage to a predicate that always returns false', () => {
    const ctx = createBuildContext(baseConfig())
    expect(ctx.isWorkspacePackage('anything')).toBe(false)
  })

  it('preserves a supplied isWorkspacePackage predicate by reference', () => {
    const predicate = (name: string): boolean => name === '@scope/x'
    const ctx = createBuildContext({ ...baseConfig(), isWorkspacePackage: predicate })
    expect(ctx.isWorkspacePackage).toBe(predicate)
  })

  it('runs entry-point discovery against the project root and stores the result', () => {
    const ctx = createBuildContext(baseConfig())
    expect(discoverEntries).toHaveBeenCalledWith('/abs/repo/libs/foo')
    expect(ctx.entryPointDiscovery).toBe(DISCOVERY)
  })

  it('captures startedAt as a wall-clock timestamp at the moment of creation', () => {
    const before = Date.now()
    const ctx = createBuildContext(baseConfig())
    const after = Date.now()
    expect(ctx.startedAt).toBeGreaterThanOrEqual(before)
    expect(ctx.startedAt).toBeLessThanOrEqual(after)
  })

  describe('bundleAllDeps integration', () => {
    let fxRoot: string
    const seedPkg = (deps: Record<string, string>, peer?: Record<string, string>): string => {
      writeFileSync(nodeJoin(fxRoot, 'package.json'), JSON.stringify({ dependencies: deps, peerDependencies: peer ?? {} }))
      return fxRoot
    }
    beforeEach(() => {
      fxRoot = mkdtempSync(nodeJoin(tmpdir(), 'builder-build-bundle-all-'))
    })
    afterEach(() => {
      rmSync(fxRoot, { recursive: true, force: true })
    })

    it('defaults bundledDeps to an empty list when no format opts in', () => {
      const projectRoot = seedPkg({ rollup: '*' })
      const ctx = createBuildContext({ projectRoot, workspaceRoot: '/abs/repo' })
      expect(ctx.bundledDeps).toEqual([])
    })

    it('populates bundledDeps when ESM opts in via boolean', () => {
      const projectRoot = seedPkg({ rollup: '*', postject: '*' })
      const ctx = createBuildContext({
        projectRoot,
        workspaceRoot: '/abs/repo',
        esm: { bundleWorkspaceDeps: false, bundleAllDeps: true },
      })
      expect(ctx.bundledDeps).toEqual(['postject', 'rollup'])
    })

    it('honours object override include / exclude across CJS and ESM configs', () => {
      const projectRoot = seedPkg({ rollup: '*', postject: '*' })
      const ctx = createBuildContext({
        projectRoot,
        workspaceRoot: '/abs/repo',
        esm: { bundleWorkspaceDeps: false, bundleAllDeps: { include: ['lodash'], exclude: ['postject'] } },
        cjs: { bundleWorkspaceDeps: false, bundleAllDeps: { include: ['lodash'] } },
      })
      expect(ctx.bundledDeps).toEqual(['lodash', 'rollup'])
    })

    it('passes the workspace predicate through so workspace deps are subtracted', () => {
      // context: the workspace dep must be resolvable (mapped + seeded) so bundleAllDeps resolution succeeds rather than failing loud
      const write = (rel: string, contents: string): void => {
        const abs = nodeJoin(fxRoot, rel)
        mkdirSync(nodeJoin(abs, '..'), { recursive: true })
        writeFileSync(abs, contents)
      }
      write('libs/foo/package.json', JSON.stringify({ dependencies: { rollup: '*', '@hyperfrontend/logging': '*' } }))
      write('libs/logging/package.json', JSON.stringify({ name: 'logging' }))
      write('libs/logging/tsconfig.lib.json', JSON.stringify({ compilerOptions: {} }))
      write('libs/logging/src/index.ts', 'export {}')
      write(
        'tsconfig.base.json',
        JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@hyperfrontend/logging': ['libs/logging/src/index.ts'] } } })
      )
      const ctx = createBuildContext({
        projectRoot: nodeJoin(fxRoot, 'libs/foo'),
        workspaceRoot: fxRoot,
        isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
        esm: { bundleWorkspaceDeps: true, bundleAllDeps: true },
      })
      expect(ctx.bundledDeps).toEqual(['rollup'])
    })

    it('handles array-of-config formats when collecting bundleAllDeps options', () => {
      const projectRoot = seedPkg({ a: '*', b: '*' })
      const ctx = createBuildContext({
        projectRoot,
        workspaceRoot: '/abs/repo',
        esm: [
          { bundleWorkspaceDeps: false, bundleAllDeps: { include: ['a'] } },
          { bundleWorkspaceDeps: false, bundleAllDeps: { exclude: ['b'] } },
        ],
      })
      expect(ctx.bundledDeps).toEqual(['a'])
    })
  })
})

describe('build', () => {
  it('runs bundle, package, bin, then files-finalize in order with the resolved context', async () => {
    const callOrder: string[] = []
    ;(<jest.Mock>runBundlePhase).mockImplementationOnce(async () => {
      callOrder.push('bundle')
      return EMPTY_FORMATS
    })
    ;(<jest.Mock>runPackagePhase).mockImplementationOnce(async () => {
      callOrder.push('package')
    })
    ;(<jest.Mock>runBinPhase).mockImplementationOnce(async () => {
      callOrder.push('bin')
      return []
    })
    ;(<jest.Mock>finalizeFilesAllowlist).mockImplementationOnce(() => {
      callOrder.push('finalize')
    })
    await build(baseConfig())
    expect(callOrder).toEqual(['bundle', 'package', 'bin', 'finalize'])
  })

  it('finalizes the files allowlist with the resolved context and config', async () => {
    const config = baseConfig()
    await build(config)
    const ctxArg = (<jest.Mock>runBinPhase).mock.calls[0][0]
    expect(finalizeFilesAllowlist).toHaveBeenCalledWith(ctxArg, config)
  })

  it('forwards the resolved BuildContext to every phase', async () => {
    await build(baseConfig())
    const ctxArg = (<jest.Mock>runBundlePhase).mock.calls[0][0]
    expect(ctxArg).toEqual(expect.objectContaining({ projectRoot: '/abs/repo/libs/foo', workspaceRoot: '/abs/repo' }))
    expect((<jest.Mock>runPackagePhase).mock.calls[0][0]).toBe(ctxArg)
    expect((<jest.Mock>runBinPhase).mock.calls[0][0]).toBe(ctxArg)
  })

  it('forwards the BuildConfig to bundle and package phases', async () => {
    const config = baseConfig()
    await build(config)
    expect(runBundlePhase).toHaveBeenCalledWith(expect.any(Object), config, undefined)
    expect(runPackagePhase).toHaveBeenCalledWith(expect.any(Object), config, EMPTY_FORMATS)
  })

  it('feeds the bundle outputs into the package phase', async () => {
    const formats: FormatOutputs = { esm: [ROOT_ENTRY], cjs: [], iife: [], umd: [] }
    ;(<jest.Mock>runBundlePhase).mockResolvedValueOnce(formats)
    await build(baseConfig())
    expect(runPackagePhase).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), formats)
  })

  it('passes the configured bin declarations to the bin phase', async () => {
    const bins: BinConfig[] = [{ name: 'cz', format: 'cjs' }]
    await build({ ...baseConfig(), bin: bins })
    expect(runBinPhase).toHaveBeenCalledWith(expect.any(Object), bins)
  })

  it('passes an empty bin list when config.bin is omitted', async () => {
    await build(baseConfig())
    expect(runBinPhase).toHaveBeenCalledWith(expect.any(Object), [])
  })

  it('returns success: true with format counts derived from FormatOutputs', async () => {
    const formats: FormatOutputs = {
      esm: [ROOT_ENTRY, ROOT_ENTRY],
      cjs: [ROOT_ENTRY],
      iife: [{ config: { globalName: 'X' }, entries: [ROOT_ENTRY] }],
      umd: [
        { config: { globalName: 'X' }, entries: [ROOT_ENTRY] },
        { config: { globalName: 'X' }, entries: [ROOT_ENTRY] },
      ],
    }
    ;(<jest.Mock>runBundlePhase).mockResolvedValueOnce(formats)
    const result = await build(baseConfig())
    expect(result.success).toBe(true)
    expect(result.formatCounts).toEqual({ esm: 2, cjs: 1, iife: 1, umd: 2 })
  })

  it('aggregates the bin outputs returned by runBinPhase', async () => {
    const binOutputs: BinOutput[] = [{ name: 'cz', kind: 'cjs', outputPath: '/abs/dist/cz.js' }]
    ;(<jest.Mock>runBinPhase).mockResolvedValueOnce(binOutputs)
    const result = await build(baseConfig())
    expect(result.binOutputs).toBe(binOutputs)
  })

  it('reports a non-negative durationMs derived from the build start time', async () => {
    const result = await build(baseConfig())
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('does not create a memory monitor when memoryMonitor is omitted', async () => {
    await build(baseConfig())
    expect(createMemoryMonitor).not.toHaveBeenCalled()
  })

  it('creates a memory monitor with default thresholds when memoryMonitor is true', async () => {
    const monitor = makeMonitor()
    ;(<jest.Mock>createMemoryMonitor).mockReturnValueOnce(monitor)
    await build({ ...baseConfig(), memoryMonitor: true })
    expect(createMemoryMonitor).toHaveBeenCalledWith(undefined)
    expect(monitor.logDebug).toHaveBeenCalledWith('build:start')
    expect(monitor.check).toHaveBeenCalledWith('bundle:end')
    expect(monitor.check).toHaveBeenCalledWith('package:end')
    expect(monitor.check).toHaveBeenCalledWith('bin:end')
    expect(monitor.logSummary).toHaveBeenCalledTimes(1)
  })

  it('creates a memory monitor with custom thresholds when memoryMonitor is an options object', async () => {
    const monitor = makeMonitor()
    ;(<jest.Mock>createMemoryMonitor).mockReturnValueOnce(monitor)
    const opts = { warningMB: 100, criticalMB: 200, growthMB: 25 }
    await build({ ...baseConfig(), memoryMonitor: opts })
    expect(createMemoryMonitor).toHaveBeenCalledWith(opts)
  })

  it('threads the resolved monitor into runBundlePhase so per-rollup checkpoints fire', async () => {
    const monitor = makeMonitor()
    ;(<jest.Mock>createMemoryMonitor).mockReturnValueOnce(monitor)
    const config = { ...baseConfig(), memoryMonitor: true }
    await build(config)
    expect(runBundlePhase).toHaveBeenCalledWith(expect.any(Object), config, monitor)
  })

  it('flushes the monitor summary and rethrows when a phase fails', async () => {
    const monitor = makeMonitor()
    ;(<jest.Mock>createMemoryMonitor).mockReturnValueOnce(monitor)
    const boom = new Error('bundle failed')
    ;(<jest.Mock>runBundlePhase).mockRejectedValueOnce(boom)
    await expect(build({ ...baseConfig(), memoryMonitor: true })).rejects.toBe(boom)
    expect(monitor.logSummary).toHaveBeenCalledTimes(1)
    expect(runPackagePhase).not.toHaveBeenCalled()
    expect(runBinPhase).not.toHaveBeenCalled()
  })

  it('rethrows phase failures even when no monitor is configured', async () => {
    const boom = new Error('package failed')
    ;(<jest.Mock>runPackagePhase).mockRejectedValueOnce(boom)
    await expect(build(baseConfig())).rejects.toBe(boom)
  })

  describe('verbose log level wiring', () => {
    afterEach(() => {
      logger.setLogLevel('error')
    })

    it('raises the shared logger to debug when verbose is true', async () => {
      await build({ ...baseConfig(), verbose: true })
      expect(logger.getLogLevel()).toBe('debug')
    })

    it('resets the shared logger to error when verbose is false', async () => {
      logger.setLogLevel('debug')
      await build({ ...baseConfig(), verbose: false })
      expect(logger.getLogLevel()).toBe('error')
    })

    it('keeps the shared logger at error when verbose is omitted', async () => {
      logger.setLogLevel('debug')
      await build(baseConfig())
      expect(logger.getLogLevel()).toBe('error')
    })
  })

  describe('output cleaning', () => {
    let workspaceRoot: string
    let outDir: string

    beforeEach(() => {
      workspaceRoot = mkdtempSync(nodeJoin(tmpdir(), 'builder-build-clean-'))
      outDir = nodeJoin(workspaceRoot, 'dist', 'libs', 'foo')
      mkdirSync(outDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(workspaceRoot, { recursive: true, force: true })
    })

    it('empties the project output directory before any phase runs, so stale artifacts do not survive', async () => {
      const stale = nodeJoin(outDir, 'index.cjs.js.map')
      writeFileSync(stale, '{}')
      ;(<jest.Mock>runBundlePhase).mockImplementationOnce(async () => {
        // why: clean must run before the first emitting phase, so by the time the bundle phase starts the stale file is already gone.
        expect(existsSync(stale)).toBe(false)
        return EMPTY_FORMATS
      })
      await build({ projectRoot: nodeJoin(workspaceRoot, 'libs', 'foo'), workspaceRoot, outputPath: outDir })
      expect(existsSync(stale)).toBe(false)
    })

    it('leaves a sibling project output under the shared dist/ untouched', async () => {
      const sibling = nodeJoin(workspaceRoot, 'dist', 'libs', 'bar', 'index.cjs.js')
      mkdirSync(nodeJoin(sibling, '..'), { recursive: true })
      writeFileSync(sibling, 'x')
      await build({ projectRoot: nodeJoin(workspaceRoot, 'libs', 'foo'), workspaceRoot, outputPath: outDir })
      expect(existsSync(sibling)).toBe(true)
    })
  })
})
