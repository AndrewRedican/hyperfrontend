import type { Tree } from '../../model'
import { afterEach, beforeEach } from 'node:test'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { Mode } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { runInit } from '../../../cli'
import { ensureSdkDependency } from '../../shared/dependencies'
import { loadDevkit } from '../../shared/devkit'
import { installPackages } from '../../shared/install'
import { featureGenerator } from './generator'

jest.mock('../../../cli', () => ({ runInit: jest.fn(), EXIT_OK: 0 }))
jest.mock('../../shared/dependencies', () => ({ ensureSdkDependency: jest.fn() }))
jest.mock('../../shared/devkit', () => ({ loadDevkit: jest.fn() }))
jest.mock('../../shared/install', () => ({ installPackages: jest.fn() }))

const runInitMock = jest.mocked(runInit)
const ensureSdkDependencyMock = jest.mocked(ensureSdkDependency)
const loadDevkitMock = jest.mocked(loadDevkit)
const installPackagesMock = jest.mocked(installPackages)

const baseOptions = { name: 'clock', contract: './c.json', entry: './src/main.ts' }

/** Structural tree fake exposing the staged files for assertions. */
interface TreeFake extends Tree {
  /** Staged file contents keyed by workspace-relative path. */
  files: Record<string, string>
}

function createTree(files: Record<string, string> = {}): TreeFake {
  const staged: Record<string, string> = { ...files }
  return {
    root: '/ws',
    files: staged,
    read: (filePath) => staged[filePath] ?? null,
    exists: (filePath) => filePath in staged,
    write: (filePath, content) => {
      staged[filePath] = content
    },
  }
}

/** What the scaffold tree handed to runInit showed and returned, beside the Nx tree it staged into. */
interface ScaffoldRun {
  /** The Nx tree the generator staged into. */
  tree: TreeFake
  /** The scaffold tree's root as runInit saw it. */
  root: string | undefined
  /** Whether each scaffold path existed before runInit wrote anything. */
  existedBefore: Record<string, boolean>
  /** What committing the scaffold returned. */
  committed: unknown
}

/**
 * Runs the generator with a runInit that scaffolds the clock feature through the staged tree.
 *
 * @returns What the scaffold observed and the Nx tree it staged into.
 */
async function runClockScaffold(): Promise<ScaffoldRun> {
  const tree = createTree({ 'apps/clock/feature.config.json': 'existing config', 'apps/clock/src/main.ts': 'entry' })
  const run: ScaffoldRun = { tree, root: undefined, existedBefore: {}, committed: undefined }
  runInitMock.mockImplementation(async (options) => {
    const createTreeFn = options.createTreeFn
    const commit = options.commit
    if (createTreeFn === undefined || commit === undefined) {
      return 1
    }
    const scaffold = createTreeFn(options.cwd)
    run.root = scaffold.root
    run.existedBefore = {
      'feature.config.json': scaffold.exists('feature.config.json'),
      'src/hyperfrontend.feature.ts': scaffold.exists('src/hyperfrontend.feature.ts'),
    }
    scaffold.write('src/hyperfrontend.feature.ts', 'glue', { mode: Mode.SkipIfExists })
    scaffold.write('feature.config.json', 'clobbering config', { mode: Mode.SkipIfExists })
    const entry = scaffold.read('src/main.ts', 'utf-8')
    scaffold.write('src/main.ts', `wired ${entry}`)
    scaffold.write('bin.dat', Buffer.from('bytes'))
    run.committed = commit(scaffold, { dryRun: false })
    return 0
  })
  await featureGenerator(tree, { ...baseOptions, directory: 'apps/clock' })
  return run
}

describe('featureGenerator', () => {
  beforeEach(() => {
    runInitMock.mockReset()
    runInitMock.mockResolvedValue(0)
    ensureSdkDependencyMock.mockReset()
    ensureSdkDependencyMock.mockReturnValue(false)
    loadDevkitMock.mockReset()
    loadDevkitMock.mockReturnValue(null)
    installPackagesMock.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('declares the SDK dependency while keeping existing versions', async () => {
    const tree = createTree()
    await featureGenerator(tree, baseOptions)
    expect(ensureSdkDependencyMock).toHaveBeenCalledWith(tree, { keepExistingVersions: true })
  })

  it('declares the SDK dependency before delegating to runInit', async () => {
    await featureGenerator(createTree(), baseOptions)
    const ensureOrder = ensureSdkDependencyMock.mock.invocationCallOrder[0]
    const runOrder = runInitMock.mock.invocationCallOrder[0]
    expect(ensureOrder).toBeLessThan(runOrder as number)
  })

  it('delegates to runInit with mapped headless flags and resolved cwd', async () => {
    await featureGenerator(createTree(), { ...baseOptions, directory: 'apps/clock' })
    expect(runInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: normalizeToNative('/ws/apps/clock'),
        flags: expect.objectContaining({ name: 'clock', contract: './c.json', entry: './src/main.ts', ci: true }),
      })
    )
  })

  it('defaults the directory to the workspace root', async () => {
    await featureGenerator(createTree(), baseOptions)
    expect(runInitMock).toHaveBeenCalledWith(expect.objectContaining({ cwd: normalizeToNative('/ws') }))
  })

  it('roots the scaffold tree at the feature directory', async () => {
    expect((await runClockScaffold()).root).toBe(normalizeToNative('/ws/apps/clock'))
  })

  it('shows the scaffold the files the Nx tree already holds', async () => {
    expect((await runClockScaffold()).existedBefore).toEqual({ 'feature.config.json': true, 'src/hyperfrontend.feature.ts': false })
  })

  it('counts the staged scaffold changes when committing', async () => {
    expect((await runClockScaffold()).committed).toEqual({ created: 2, updated: 1, deleted: 0, changes: [], dryRun: false })
  })

  it('stages scaffold writes into the Nx tree', async () => {
    expect((await runClockScaffold()).tree.files).toEqual(
      expect.objectContaining({
        'apps/clock/src/hyperfrontend.feature.ts': 'glue',
        'apps/clock/src/main.ts': 'wired entry',
        'apps/clock/bin.dat': 'bytes',
      })
    )
  })

  it('honors skip-if-exists for a file the Nx tree already holds', async () => {
    expect((await runClockScaffold()).tree.files['apps/clock/feature.config.json']).toBe('existing config')
  })

  it('translates absolute SDK paths into workspace-relative staged writes', async () => {
    const tree = createTree()
    runInitMock.mockImplementation(async (options) => {
      const scaffold = options.createTreeFn?.(options.cwd)
      if (scaffold === undefined) {
        return 1
      }
      scaffold.write('/ws/apps/clock/clock.contract.d.ts', 'declare const contract: unknown')
      return 0
    })
    await featureGenerator(tree, { ...baseOptions, directory: 'apps/clock' })
    expect(tree.files['apps/clock/clock.contract.d.ts']).toBe('declare const contract: unknown')
  })

  it('forwards the NX_DRY_RUN environment flag into the SDK dry-run wording', async () => {
    jest.stubEnv('NX_DRY_RUN', 'true')
    await featureGenerator(createTree(), baseOptions)
    expect(runInitMock).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.objectContaining({ dryRun: true }) }))
  })

  it('throws when the SDK run exits non-zero', async () => {
    runInitMock.mockResolvedValue(1)
    await expect(featureGenerator(createTree(), baseOptions)).rejects.toThrow('hf init failed with exit code 1.')
  })

  it('awaits devkit formatFiles in the generator body when present', async () => {
    const formatFiles = jest.fn(async () => undefined)
    loadDevkitMock.mockReturnValue({ formatFiles })
    const tree = createTree()
    await featureGenerator(tree, baseOptions)
    expect(formatFiles).toHaveBeenCalledWith(tree)
  })

  it('defers the devkit install until the returned callback runs', async () => {
    ensureSdkDependencyMock.mockReturnValue(true)
    const installPackagesTask = jest.fn()
    loadDevkitMock.mockReturnValue({ installPackagesTask })
    await featureGenerator(createTree(), baseOptions)
    expect(installPackagesTask).not.toHaveBeenCalled()
  })

  it('returns a callback that installs through devkit when the dependency was declared', async () => {
    ensureSdkDependencyMock.mockReturnValue(true)
    const installPackagesTask = jest.fn()
    loadDevkitMock.mockReturnValue({ installPackagesTask })
    const tree = createTree()
    const callback = await featureGenerator(tree, baseOptions)
    await callback()
    expect(installPackagesTask).toHaveBeenCalledWith(tree)
  })

  it('skips the built-in installer when devkit installs', async () => {
    ensureSdkDependencyMock.mockReturnValue(true)
    loadDevkitMock.mockReturnValue({ installPackagesTask: jest.fn() })
    const callback = await featureGenerator(createTree(), baseOptions)
    await callback()
    expect(installPackagesMock).not.toHaveBeenCalled()
  })

  it('returns a callback that falls back to the built-in installer when devkit is absent', async () => {
    ensureSdkDependencyMock.mockReturnValue(true)
    const tree = createTree()
    const callback = await featureGenerator(tree, baseOptions)
    await callback()
    expect(installPackagesMock).toHaveBeenCalledWith(tree)
  })

  it('returns a callback that installs nothing when the dependency was already declared', async () => {
    const installPackagesTask = jest.fn()
    loadDevkitMock.mockReturnValue({ installPackagesTask })
    const callback = await featureGenerator(createTree(), baseOptions)
    await callback()
    expect({ devkitInstalls: installPackagesTask.mock.calls, builtInInstalls: installPackagesMock.mock.calls }).toEqual({
      devkitInstalls: [],
      builtInInstalls: [],
    })
  })
})
