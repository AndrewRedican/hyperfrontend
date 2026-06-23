import type { RollupBuildDescriptor } from '../../bundle/rollup/worker/types'
import type { BinConfig, BuildContext } from '../../models'
import { ensureDir } from '@hyperfrontend/project-scope/core'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from '../../bundle/rollup/dispatch'
import { buildJsBin } from './build-bin'
jest.mock('../../bundle/rollup/dispatch', () => ({
  dispatchRollupWorker: jest.fn().mockResolvedValue(undefined),
  resolveDefaultRollupWorkerPath: jest.fn(() => ({ path: '/abs/repo/dist/libs/builder/bundle/rollup/worker/index.cjs.js', execArgv: [] })),
}))
jest.mock('@hyperfrontend/project-scope/core', () => {
  const actual = jest.requireActual('@hyperfrontend/project-scope/core')
  return { ...actual, ensureDir: jest.fn() }
})

const makeContext = (overrides: Partial<BuildContext> = {}): BuildContext => ({
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
  ...overrides,
})

beforeEach(() => {
  ;(<jest.Mock>dispatchRollupWorker).mockClear()
  ;(<jest.Mock>resolveDefaultRollupWorkerPath).mockClear().mockReturnValue({
    path: '/abs/repo/dist/libs/builder/bundle/rollup/worker/index.cjs.js',
    execArgv: [],
  })
  ;(<jest.Mock>ensureDir).mockClear()
})

const dispatchedDescriptor = (callIndex: number): RollupBuildDescriptor =>
  <RollupBuildDescriptor>(<jest.Mock>dispatchRollupWorker).mock.calls[callIndex][0]

describe('buildJsBin', () => {
  it('ensures the bin output directory exists before dispatching', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs' }, makeContext())
    expect(ensureDir).toHaveBeenCalledWith('/abs/dist/libs/foo/bin')
  })

  it('emits a single CJS output as `<name>.js` when only CJS is declared', async () => {
    const result = await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs', runner: 'runCz' }, makeContext())
    expect(result).toEqual([{ name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/cz.js' }])
  })

  it('emits an ESM output as `<name>.mjs`', async () => {
    const result = await buildJsBin(<BinConfig>{ name: 'cz', format: 'esm', runner: 'runCz' }, makeContext())
    expect(result).toEqual([{ name: 'cz', kind: 'esm', outputPath: '/abs/dist/libs/foo/bin/cz.mjs' }])
  })

  it('emits both CJS (`<name>.cjs.js`) and ESM (`<name>.mjs`) when an array of formats is declared', async () => {
    const result = await buildJsBin(<BinConfig>{ name: 'hf-build', format: ['cjs', 'esm'] }, makeContext())
    expect(result).toEqual([
      { name: 'hf-build', kind: 'cjs', outputPath: '/abs/dist/libs/foo/bin/hf-build.cjs.js' },
      { name: 'hf-build', kind: 'esm', outputPath: '/abs/dist/libs/foo/bin/hf-build.mjs' },
    ])
  })

  it('dispatches one worker per format with the correct descriptor shape', async () => {
    await buildJsBin(<BinConfig>{ name: 'hf-build', format: ['cjs', 'esm'] }, makeContext())
    expect(dispatchRollupWorker).toHaveBeenCalledTimes(2)
    const cjs = dispatchedDescriptor(0)
    const esm = dispatchedDescriptor(1)
    expect(cjs.format).toBe('cjs')
    expect(cjs.inputFile).toBe('/abs/libs/foo/src/bin/hf-build.ts')
    expect(cjs.bin?.outputFile).toBe('/abs/dist/libs/foo/bin/hf-build.cjs.js')
    expect(cjs.bin?.banner).toBe('#!/usr/bin/env node')
    expect(cjs.bin?.chmod).toBe(0o755)
    expect(esm.format).toBe('esm')
    expect(esm.bin?.outputFile).toBe('/abs/dist/libs/foo/bin/hf-build.mjs')
  })

  it('labels the dispatch invocation with `bin:<name>:<format>` for traceability', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: ['cjs', 'esm'] }, makeContext())
    expect(dispatchRollupWorker).toHaveBeenNthCalledWith(1, expect.any(Object), expect.objectContaining({ label: 'bin:cz:cjs' }))
    expect(dispatchRollupWorker).toHaveBeenNthCalledWith(2, expect.any(Object), expect.objectContaining({ label: 'bin:cz:esm' }))
  })

  it('threads the resolved worker path + execArgv into the dispatch options', async () => {
    ;(<jest.Mock>resolveDefaultRollupWorkerPath).mockReturnValue({
      path: '/abs/repo/libs/builder/src/bundle/rollup/worker/index.ts',
      execArgv: ['--require', '@swc-node/register'],
    })
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs' }, makeContext())
    expect(dispatchRollupWorker).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        workerPath: '/abs/repo/libs/builder/src/bundle/rollup/worker/index.ts',
        execArgv: ['--require', '@swc-node/register'],
      })
    )
  })

  it('throws when the rollup worker cannot be resolved', async () => {
    ;(<jest.Mock>resolveDefaultRollupWorkerPath).mockReturnValue(undefined)
    await expect(buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs' }, makeContext())).rejects.toThrow(/rollup worker/)
  })

  it('configures the descriptor with the bootstrap footer for the runner export', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs', runner: 'runCz' }, makeContext())
    const descriptor = dispatchedDescriptor(0)
    expect(descriptor.bin?.footer).toContain('runCz(')
  })

  it('configures the ESM descriptor with the ESM-flavored bootstrap footer', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'esm' }, makeContext())
    const descriptor = dispatchedDescriptor(0)
    expect(descriptor.bin?.footer).toContain('await import(import.meta.url)')
  })

  it('honors a per-bin bootstrap override on the descriptor footer', async () => {
    await buildJsBin(<BinConfig>{ name: 'cz', format: 'cjs', bootstrap: '// custom-footer' }, makeContext())
    const descriptor = dispatchedDescriptor(0)
    expect(descriptor.bin?.footer).toBe('// custom-footer')
  })
})
