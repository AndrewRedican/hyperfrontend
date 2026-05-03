jest.mock('@rollup/plugin-commonjs', () => jest.fn(() => ({ name: 'commonjs' })))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
jest.mock('@rollup/plugin-node-resolve', () => jest.fn(() => ({ name: 'node-resolve' })))
jest.mock('@rollup/plugin-terser', () => jest.fn(() => ({ name: 'terser' })))
jest.mock('@rollup/plugin-typescript', () => jest.fn(() => ({ name: 'typescript' })))

jest.mock('./rollup/execute', () => ({ executeRollup: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./declarations/generate-declarations', () => ({
  generateDeclarations: jest.fn().mockResolvedValue({ success: true, stdout: '', stderr: '' }),
}))
jest.mock('@hyperfrontend/project-scope/core', () => {
  const actual = jest.requireActual('@hyperfrontend/project-scope/core')
  return { ...actual, ensureDir: jest.fn() }
})

import type { BuildConfig, BuildContext, EntryPoint, EntryPointDiscovery } from '../models'
import { ensureDir } from '@hyperfrontend/project-scope/core'
import { generateDeclarations } from './declarations/generate-declarations'
import { executeRollup } from './rollup/execute'
import { runBundlePhase } from './run-bundle-phase'

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
  startedAt: 0,
})

beforeEach(() => {
  ;(<jest.Mock>executeRollup).mockClear()
  ;(<jest.Mock>generateDeclarations).mockClear()
  ;(<jest.Mock>ensureDir).mockClear()
})

describe('runBundlePhase', () => {
  it('returns empty per-format arrays when no formats are configured', async () => {
    const result = await runBundlePhase(makeContext(), <BuildConfig>{ projectRoot: '', workspaceRoot: '' })
    expect(result).toEqual({ esm: [], cjs: [], iife: [], umd: [] })
  })

  it('invokes rollup once per resolved ESM entry', async () => {
    await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
    })
    expect(executeRollup).toHaveBeenCalledTimes(2)
  })

  it('respects per-format entry filters when resolving entries', async () => {
    const result = await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false, entry: '.' },
    })
    expect(result.esm).toEqual([expect.objectContaining({ exportPath: '.' })])
  })

  it('invokes rollup for every CJS entry when configured', async () => {
    await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      cjs: { bundleWorkspaceDeps: false },
    })
    expect(executeRollup).toHaveBeenCalledTimes(2)
  })

  it('records IIFE outputs and ensures the bundle directory exists when at least one entry resolves', async () => {
    const result = await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      iife: { globalName: 'MyLib', entry: '.' },
    })
    expect(result.iife).toEqual([expect.objectContaining({ entries: [expect.objectContaining({ exportPath: '.' })] })])
    expect(ensureDir).toHaveBeenCalledWith('/abs/dist/libs/foo/bundle')
  })

  it('skips IIFE bookkeeping when no entry resolves', async () => {
    const result = await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      iife: { globalName: 'MyLib', entry: './missing' },
    })
    expect(result.iife).toEqual([])
  })

  it('records UMD outputs and ensures the bundle directory exists when at least one entry resolves', async () => {
    const result = await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      umd: { globalName: 'MyLib', entry: '.' },
    })
    expect(result.umd).toEqual([expect.objectContaining({ entries: [expect.objectContaining({ exportPath: '.' })] })])
  })

  it('skips UMD bookkeeping when no entry resolves', async () => {
    const result = await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      umd: { globalName: 'MyLib', entry: './missing' },
    })
    expect(result.umd).toEqual([])
  })

  it('honors the per-format `output` override when ensuring the bundle directory', async () => {
    await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      iife: { globalName: 'MyLib', entry: '.', output: 'iife-bundle' },
    })
    expect(ensureDir).toHaveBeenCalledWith('/abs/dist/libs/foo/iife-bundle')
  })

  it('runs declaration emission exactly once after every format is built', async () => {
    await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
      cjs: { bundleWorkspaceDeps: false },
    })
    expect(generateDeclarations).toHaveBeenCalledTimes(1)
  })

  it('accepts an array of per-format configurations and processes them in order', async () => {
    await runBundlePhase(makeContext(), <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      esm: [
        { bundleWorkspaceDeps: false, entry: '.' },
        { bundleWorkspaceDeps: false, entry: './browser' },
      ],
    })
    expect(executeRollup).toHaveBeenCalledTimes(2)
  })

  it('drives the optional monitor with start/end check labels for every rollup invocation and the declarations phase', async () => {
    const labels: string[] = []
    const monitor = { check: (label: string) => void labels.push(label) } as unknown as Parameters<typeof runBundlePhase>[2]
    await runBundlePhase(
      makeContext(),
      <BuildConfig>{
        projectRoot: '',
        workspaceRoot: '',
        esm: { bundleWorkspaceDeps: false },
        cjs: { bundleWorkspaceDeps: false, entry: '.' },
      },
      monitor
    )
    expect(labels).toEqual([
      'bundle:esm:0/2:.:start',
      'bundle:esm:0/2:.:end',
      'bundle:esm:1/2:./browser:start',
      'bundle:esm:1/2:./browser:end',
      'bundle:cjs:0/1:.:start',
      'bundle:cjs:0/1:.:end',
      'bundle:declarations:start',
      'bundle:declarations:end',
    ])
  })

  it('emits monitor labels for IIFE and UMD entries when configured', async () => {
    const labels: string[] = []
    const monitor = { check: (label: string) => void labels.push(label) } as unknown as Parameters<typeof runBundlePhase>[2]
    await runBundlePhase(
      makeContext(),
      <BuildConfig>{
        projectRoot: '',
        workspaceRoot: '',
        iife: { globalName: 'MyLib', entry: '.' },
        umd: { globalName: 'MyLib', entry: '.' },
      },
      monitor
    )
    expect(labels).toEqual([
      'bundle:iife:0/1:.:start',
      'bundle:iife:0/1:.:end',
      'bundle:umd:0/1:.:start',
      'bundle:umd:0/1:.:end',
      'bundle:declarations:start',
      'bundle:declarations:end',
    ])
  })

  it('produces identical outputs whether or not a monitor is supplied', async () => {
    const config = <BuildConfig>{
      projectRoot: '',
      workspaceRoot: '',
      esm: { bundleWorkspaceDeps: false },
      cjs: { bundleWorkspaceDeps: false },
    }
    const withoutMonitor = await runBundlePhase(makeContext(), config)
    const monitor = { check: jest.fn() } as unknown as Parameters<typeof runBundlePhase>[2]
    const withMonitor = await runBundlePhase(makeContext(), config, monitor)
    expect(withMonitor).toEqual(withoutMonitor)
  })
})
