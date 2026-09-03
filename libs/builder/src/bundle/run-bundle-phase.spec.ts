import type { Mock } from '@hyperfrontend/testing'
import type { BuildConfig, BuildContext, EntryPoint, EntryPointDiscovery } from '../models'
import { beforeEach } from 'node:test'
import { ensureDir } from '@hyperfrontend/project-scope/core'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { runDtsPerEntry } from './declarations/dts-per-entry'
import { runDtsPrePass } from './declarations/dts-pre-pass'
import { generateDeclarations } from './declarations/generate-declarations'
import { pruneOrphanDeclarations } from './declarations/prune-orphan-dts'
import { verifyEntryTypeRefs } from './declarations/verify-entry-refs'
import { resolveDefaultWorkerPath, runPrePass } from './dependencies/pre-pass'
import { pruneDependencies } from './dependencies/prune/prune-dependencies'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from './rollup/dispatch'
import { runBundlePhase } from './run-bundle-phase'
import { stripBundleCommentsPass } from './strip-bundle-comments'
jest.mock('@rollup/plugin-commonjs', () => jest.fn(() => ({ name: 'commonjs' })))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
jest.mock('@rollup/plugin-node-resolve', () => jest.fn(() => ({ name: 'node-resolve' })))
jest.mock('@rollup/plugin-terser', () => jest.fn(() => ({ name: 'terser' })))
jest.mock('@rollup/plugin-typescript', () => jest.fn(() => ({ name: 'typescript' })))
jest.mock('./rollup/dispatch', () => ({
  dispatchRollupWorker: jest.fn().mockResolvedValue({ outputSize: 0, endHeapMB: 0, endRssMB: 0, durationMs: 0 }),
  resolveDefaultRollupWorkerPath: jest.fn(),
}))
jest.mock('./declarations/generate-declarations', () => ({
  generateDeclarations: jest.fn().mockResolvedValue({ success: true, stdout: '', stderr: '' }),
}))
jest.mock('@hyperfrontend/project-scope/core', () => {
  const actual = jest.requireActual('@hyperfrontend/project-scope/core')
  return { ...actual, ensureDir: jest.fn() }
})
jest.mock('./dependencies/pre-pass', () => ({
  runPrePass: jest.fn().mockResolvedValue([]),
  resolveDefaultWorkerPath: jest.fn(),
}))
jest.mock('./dependencies/resolve-dep-entry', () => ({
  resolveDepEntry: jest.fn().mockReturnValue('/abs/repo/node_modules/<dep>/index.js'),
}))
jest.mock('./declarations/dts-pre-pass', () => ({ runDtsPrePass: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./declarations/dts-per-entry', () => ({ runDtsPerEntry: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./declarations/prune-orphan-dts', () => ({ pruneOrphanDeclarations: jest.fn().mockReturnValue(0) }))
jest.mock('./declarations/verify-entry-refs', () => ({ verifyEntryTypeRefs: jest.fn() }))
jest.mock('./dependencies/prune/prune-dependencies', () => ({
  pruneDependencies: jest.fn().mockReturnValue({ orphanFilesRemoved: 0, deadExportsRemoved: 0, bytesRemoved: 0 }),
}))
jest.mock('./strip-bundle-comments', () => ({
  stripBundleCommentsPass: jest.fn().mockReturnValue({ commentBytesRemoved: 0 }),
}))

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/libs/foo/src/index.ts', isRoot: true }
const BROWSER_ENTRY: EntryPoint = {
  exportPath: './browser',
  srcPath: 'browser',
  inputFile: '/abs/libs/foo/src/browser/index.ts',
  isRoot: false,
  platform: 'browser',
}

const DISCOVERY: EntryPointDiscovery = {
  category: 'hybrid',
  entryPoints: [ROOT_ENTRY, BROWSER_ENTRY],
  hasRootEntry: true,
  platformEntries: [BROWSER_ENTRY],
  featureEntries: [],
}

const ROLLUP_WORKER_PATH = '/abs/dist/libs/builder/bundle/rollup/worker/index.cjs.js'

// why: casting in statement position needs a leading semicolon, an ASI hazard static analysis rejects.
const asMock = (fn: unknown): Mock => fn as Mock

const makeContext = (): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath: '/abs/dist/libs/foo',
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: DISCOVERY,
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

beforeEach(() => {
  asMock(dispatchRollupWorker).mockClear()
  asMock(generateDeclarations).mockClear()
  asMock(ensureDir).mockClear()
  asMock(runPrePass).mockClear()
  asMock(runDtsPrePass).mockClear()
  asMock(runDtsPerEntry).mockClear()
  asMock(pruneOrphanDeclarations).mockClear()
  asMock(verifyEntryTypeRefs).mockClear()
  asMock(pruneDependencies).mockClear()
  asMock(stripBundleCommentsPass).mockClear()
  asMock(resolveDefaultWorkerPath)
    .mockReset()
    .mockReturnValue({ path: '/abs/dist/libs/builder/bundle/dependencies/worker/index.cjs.js', execArgv: [] })
  asMock(resolveDefaultRollupWorkerPath).mockReset().mockReturnValue({ path: ROLLUP_WORKER_PATH, execArgv: [] })
})

describe('runBundlePhase', () => {
  it('returns empty per-format arrays when no formats are configured', async () => {
    const result = await runBundlePhase(makeContext(), { projectRoot: '', workspaceRoot: '' } as BuildConfig)
    expect(result).toEqual({ esm: [], cjs: [], iife: [], umd: [] })
  })

  it('forks one rollup worker per resolved ESM entry', async () => {
    await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
    } as BuildConfig)
    expect(dispatchRollupWorker).toHaveBeenCalledTimes(2)
    const [descriptor, options] = (dispatchRollupWorker as Mock).mock.calls[0]
    expect(descriptor.format).toBe('esm')
    expect(options.workerPath).toBe(ROLLUP_WORKER_PATH)
  })

  it('respects per-format entry filters when resolving entries', async () => {
    const result = await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false, entry: '.' },
    } as BuildConfig)
    expect(result.esm).toEqual([expect.objectContaining({ exportPath: '.' })])
  })

  it('forks one rollup worker per resolved CJS entry', async () => {
    await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      cjs: { bundleWorkspaceDeps: false },
    } as BuildConfig)
    expect(dispatchRollupWorker).toHaveBeenCalledTimes(2)
    const [descriptor] = (dispatchRollupWorker as Mock).mock.calls[0]
    expect(descriptor.format).toBe('cjs')
  })

  it('records IIFE outputs and ensures the bundle directory exists when at least one entry resolves', async () => {
    const result = await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      iife: { globalName: 'MyLib', entry: '.' },
    } as BuildConfig)
    expect(result.iife).toEqual([expect.objectContaining({ entries: [expect.objectContaining({ exportPath: '.' })] })])
    expect(ensureDir).toHaveBeenCalledWith('/abs/dist/libs/foo/bundle')
  })

  it('skips IIFE bookkeeping when no entry resolves', async () => {
    const result = await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      iife: { globalName: 'MyLib', entry: './missing' },
    } as BuildConfig)
    expect(result.iife).toEqual([])
  })

  it('records UMD outputs and ensures the bundle directory exists when at least one entry resolves', async () => {
    const result = await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      umd: { globalName: 'MyLib', entry: '.' },
    } as BuildConfig)
    expect(result.umd).toEqual([expect.objectContaining({ entries: [expect.objectContaining({ exportPath: '.' })] })])
  })

  it('skips UMD bookkeeping when no entry resolves', async () => {
    const result = await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      umd: { globalName: 'MyLib', entry: './missing' },
    } as BuildConfig)
    expect(result.umd).toEqual([])
  })

  it('honors the per-format `output` override when ensuring the bundle directory', async () => {
    await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      iife: { globalName: 'MyLib', entry: '.', output: 'iife-bundle' },
    } as BuildConfig)
    expect(ensureDir).toHaveBeenCalledWith('/abs/dist/libs/foo/iife-bundle')
  })

  it('runs the bundle comment strip once with the output path and the recorded format outputs', async () => {
    const result = await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      iife: { globalName: 'MyLib', entry: '.' },
      umd: { globalName: 'MyLib', entry: '.' },
    } as BuildConfig)
    expect(stripBundleCommentsPass).toHaveBeenCalledWith('/abs/dist/libs/foo', result)
  })

  it('runs declaration emission exactly once after every format is built', async () => {
    await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
      cjs: { bundleWorkspaceDeps: false },
    } as BuildConfig)
    expect(generateDeclarations).toHaveBeenCalledTimes(1)
  })

  it('accepts an array of per-format configurations and processes them in order', async () => {
    await runBundlePhase(makeContext(), {
      projectRoot: '',
      workspaceRoot: '',
      esm: [
        { bundleWorkspaceDeps: false, entry: '.' },
        { bundleWorkspaceDeps: false, entry: './browser' },
      ],
    } as BuildConfig)
    expect(dispatchRollupWorker).toHaveBeenCalledTimes(2)
  })

  it('drives the optional monitor with start/end check labels for every rollup invocation and the declarations phase', async () => {
    const labels: string[] = []
    const monitor = { check: (label: string) => void labels.push(label) } as unknown as Parameters<typeof runBundlePhase>[2]
    await runBundlePhase(
      makeContext(),
      {
        projectRoot: '',
        workspaceRoot: '',
        esm: { bundleWorkspaceDeps: false },
        cjs: { bundleWorkspaceDeps: false, entry: '.' },
      } as BuildConfig,
      monitor
    )
    expect(labels).toEqual([
      'bundle:esm:0/2:.:start',
      'bundle:esm:0/2:.:end',
      'bundle:esm:1/2:./browser:start',
      'bundle:esm:1/2:./browser:end',
      'bundle:esm:end:post-recover',
      'bundle:cjs:0/1:.:start',
      'bundle:cjs:0/1:.:end',
      'bundle:cjs:end:post-recover',
      'bundle:strip-comments:end',
      'bundle:declarations:start',
      'bundle:declarations:end',
      'bundle:declarations:prune-orphans:end',
      'bundle:declarations:verify-entry-refs:end',
      'bundle:dedupe:shared-first-party:end',
      'bundle:empty-dirs:end',
    ])
  })

  it('skips the shared-first-party dedupe checkpoint when dedupeSharedInternals is false', async () => {
    const labels: string[] = []
    const monitor = { check: (label: string) => void labels.push(label) } as unknown as Parameters<typeof runBundlePhase>[2]
    await runBundlePhase(
      makeContext(),
      { projectRoot: '', workspaceRoot: '', esm: { bundleWorkspaceDeps: false }, dedupeSharedInternals: false } as BuildConfig,
      monitor
    )
    expect(labels).not.toContain('bundle:dedupe:shared-first-party:end')
  })

  it('emits monitor labels for IIFE and UMD entries when configured', async () => {
    const labels: string[] = []
    const monitor = { check: (label: string) => void labels.push(label) } as unknown as Parameters<typeof runBundlePhase>[2]
    await runBundlePhase(
      makeContext(),
      {
        projectRoot: '',
        workspaceRoot: '',
        iife: { globalName: 'MyLib', entry: '.' },
        umd: { globalName: 'MyLib', entry: '.' },
      } as BuildConfig,
      monitor
    )
    expect(labels).toEqual([
      'bundle:esm:end:post-recover',
      'bundle:cjs:end:post-recover',
      'bundle:iife:0/1:.:start',
      'bundle:iife:0/1:.:end',
      'bundle:umd:0/1:.:start',
      'bundle:umd:0/1:.:end',
      'bundle:strip-comments:end',
      'bundle:declarations:start',
      'bundle:declarations:end',
      'bundle:declarations:prune-orphans:end',
      'bundle:declarations:verify-entry-refs:end',
      'bundle:dedupe:shared-first-party:end',
      'bundle:empty-dirs:end',
    ])
  })

  it('produces identical outputs whether or not a monitor is supplied', async () => {
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
      cjs: { bundleWorkspaceDeps: false },
    } as BuildConfig
    const withoutMonitor = await runBundlePhase(makeContext(), config)
    const monitor = { check: jest.fn() } as unknown as Parameters<typeof runBundlePhase>[2]
    const withMonitor = await runBundlePhase(makeContext(), config, monitor)
    expect(withMonitor).toEqual(withoutMonitor)
  })

  it('skips the dependencies pre-pass when bundledDeps is empty', async () => {
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false, bundleAllDeps: true },
    } as BuildConfig
    await runBundlePhase(makeContext(), config)
    expect(runPrePass).not.toHaveBeenCalled()
  })

  it('skips the dependencies pre-pass when no format opts in', async () => {
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
    } as BuildConfig
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup']
    await runBundlePhase(ctx, config)
    expect(runPrePass).not.toHaveBeenCalled()
  })

  it('runs the dependencies pre-pass when bundledDeps is non-empty and at least one format opts in', async () => {
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false, bundleAllDeps: true },
      cjs: { bundleWorkspaceDeps: false, bundleAllDeps: true },
    } as BuildConfig
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup', 'postject']
    await runBundlePhase(ctx, config)
    expect(runPrePass).toHaveBeenCalledTimes(1)
    const [jobs, options] = (runPrePass as Mock).mock.calls[0]
    expect(jobs).toHaveLength(4)
    expect(jobs.every((j: { kind: string }) => j.kind === 'js')).toBe(true)
    expect(options.workerPath).toBe('/abs/dist/libs/builder/bundle/dependencies/worker/index.cjs.js')
  })

  it('throws a context-rich error when the pre-pass worker cannot be located', async () => {
    asMock(resolveDefaultWorkerPath).mockReturnValueOnce(undefined)
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false, bundleAllDeps: true },
    } as BuildConfig
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup']
    await expect(runBundlePhase(ctx, config)).rejects.toThrow(/pre-pass worker could not be located beside the builder module/)
  })

  it('throws a context-rich error when the rollup worker cannot be located', async () => {
    asMock(resolveDefaultRollupWorkerPath).mockReturnValueOnce(undefined)
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
    } as BuildConfig
    await expect(runBundlePhase(makeContext(), config)).rejects.toThrow(/rollup worker could not be located beside the builder module/)
  })

  it('does not require the rollup worker when no format resolves any entry', async () => {
    asMock(resolveDefaultRollupWorkerPath).mockReturnValueOnce(undefined)
    await runBundlePhase(makeContext(), { projectRoot: '', workspaceRoot: '' } as BuildConfig)
    expect(dispatchRollupWorker).not.toHaveBeenCalled()
  })

  it('emits monitor checkpoints around the pre-pass when active', async () => {
    const checks: string[] = []
    const monitor = { check: (label: string) => checks.push(label) } as unknown as Parameters<typeof runBundlePhase>[2]
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false, bundleAllDeps: true },
    } as BuildConfig
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup']
    await runBundlePhase(ctx, config, monitor)
    expect(checks[0]).toBe('bundle:dependencies:prepass:start')
    expect(checks).toContain('bundle:dependencies:prepass:end')
  })

  it('runs the d.ts pre-pass and per-entry d.ts pass after declarations when bundledDeps is non-empty', async () => {
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false, bundleAllDeps: true },
    } as BuildConfig
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup']
    await runBundlePhase(ctx, config)
    expect(runDtsPrePass).toHaveBeenCalledTimes(1)
    expect(runDtsPerEntry).toHaveBeenCalledTimes(1)
  })

  it('always prunes orphan .d.ts files after declarations, regardless of bundleAllDeps', async () => {
    await runBundlePhase(makeContext(), { projectRoot: '', workspaceRoot: '' } as BuildConfig)
    expect(pruneOrphanDeclarations).toHaveBeenCalledTimes(1)
  })

  it('verifies the emitted entry type references, regardless of bundleAllDeps', async () => {
    const ctx = makeContext()
    await runBundlePhase(ctx, { projectRoot: '', workspaceRoot: '' } as BuildConfig)
    expect(verifyEntryTypeRefs).toHaveBeenCalledWith(ctx)
  })

  it('prunes dependency orphans when bundledDeps is non-empty', async () => {
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup']
    await runBundlePhase(ctx, { projectRoot: '', workspaceRoot: '' } as BuildConfig)
    expect(pruneDependencies).toHaveBeenCalledWith(ctx, undefined)
  })

  it('prunes dependency orphans when workspaceBundledDeps is non-empty', async () => {
    const ctx = makeContext()
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
    await runBundlePhase(ctx, { projectRoot: '', workspaceRoot: '' } as BuildConfig)
    expect(pruneDependencies).toHaveBeenCalledTimes(1)
  })

  it('skips dependency orphan pruning when no deps are bundled', async () => {
    await runBundlePhase(makeContext(), { projectRoot: '', workspaceRoot: '' } as BuildConfig)
    expect(pruneDependencies).not.toHaveBeenCalled()
  })

  it('emits the dependency-prune checkpoint after pruning when deps are bundled', async () => {
    const checks: string[] = []
    const monitor = { check: (label: string) => checks.push(label) } as unknown as Parameters<typeof runBundlePhase>[2]
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup']
    await runBundlePhase(ctx, { projectRoot: '', workspaceRoot: '' } as BuildConfig, monitor)
    expect(checks).toContain('bundle:dependencies:prune:end')
  })

  it('skips the d.ts pre-pass and per-entry pass when no bundled deps', async () => {
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
    } as BuildConfig
    await runBundlePhase(makeContext(), config)
    expect(runDtsPrePass).not.toHaveBeenCalled()
    expect(runDtsPerEntry).not.toHaveBeenCalled()
  })

  it('threads npmDeps, workspaceRoutes, and depsRoot into js pre-pass jobs', async () => {
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false, bundleAllDeps: true },
    } as BuildConfig
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup', 'postject']
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
    await runBundlePhase(ctx, config)
    const jobs = (runPrePass as Mock).mock.calls[0][0]
    const npmJobs = jobs.filter((j: { kind: string }) => j.kind === 'js')
    expect(npmJobs).toHaveLength(2)
    expect(npmJobs[0].depsRoot).toBe('/abs/dist/libs/foo/_dependencies')
    expect(npmJobs[0].dep).toBe('rollup')
    expect(npmJobs[0].npmDeps).toEqual(['postject'])
    expect(npmJobs[0].workspaceRoutes).toEqual([{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }])
    expect(npmJobs[1].dep).toBe('postject')
    expect(npmJobs[1].npmDeps).toEqual(['rollup'])
  })

  it('threads npmDeps and self-excluded workspaceRoutes into workspace-js pre-pass jobs', async () => {
    const config = {
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: true, bundleAllDeps: true },
    } as BuildConfig
    const ctx = makeContext()
    ctx.bundledDeps = ['rollup']
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
    await runBundlePhase(ctx, config)
    const jobs = (runPrePass as Mock).mock.calls[0][0]
    const workspaceJobs = jobs.filter((j: { kind: string }) => j.kind === 'workspace-js')
    expect(workspaceJobs).toHaveLength(2)
    expect(workspaceJobs[0].dep).toBe('@hyperfrontend/logging')
    expect(workspaceJobs[0].depsRoot).toBe('/abs/dist/libs/foo/_dependencies')
    expect(workspaceJobs[0].npmDeps).toEqual(['rollup'])
    expect(workspaceJobs[0].workspaceRoutes).toEqual([{ packageName: '@hyperfrontend/project-scope', policy: 'whole-surface' }])
    expect(workspaceJobs[1].dep).toBe('@hyperfrontend/project-scope')
    expect(workspaceJobs[1].workspaceRoutes).toEqual([{ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }])
  })
})
