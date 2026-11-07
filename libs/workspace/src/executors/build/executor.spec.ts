import type { BuildConfig } from '@hyperfrontend/builder/models'
import type { Mock } from '@hyperfrontend/testing'
import type { ExecutorContext } from '../../runner/contract'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { build } from '@hyperfrontend/builder'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { logger } from '../shared/logger'
import { buildExecutor } from './executor'

jest.mock('@hyperfrontend/builder', () => ({ build: jest.fn() }))
jest.mock('../shared/logger', () => ({ logger: { setLogLevel: jest.fn(), error: jest.fn(), debug: jest.fn() } }))

const mockBuild = build as Mock
const mockLevel = logger.setLogLevel as Mock
const mockError = logger.error as Mock
const mockDebug = logger.debug as Mock

const workspace = useTempDir({
  prefix: 'build-executor-',
  tree: {
    LICENSE: 'MIT\n',
    'libs/a/package.json': { name: '@fixture/a' },
    'libs/b/package.json': { name: '@fixture/b' },
    'libs/nameless/keep.txt': '',
  },
})

/**
 * The context of a build task of the library at `libs/a`.
 *
 * @returns The context, rooted at the temporary workspace
 */
function context(): ExecutorContext {
  return {
    root: workspace.path,
    cwd: workspace.path,
    projectName: 'lib-a',
    targetName: 'build',
    target: {},
    projects: {
      'lib-a': { root: 'libs/a' },
      'lib-b': { root: 'libs/b' },
      'lib-nameless': { root: 'libs/nameless' },
    },
    configuration: {},
  }
}

/**
 * The configuration the one build started received.
 *
 * @returns The configuration
 */
function builtWith(): BuildConfig {
  return mockBuild.mock.calls[0]?.[0] as BuildConfig
}

/**
 * Every line logged at a level, in order.
 *
 * @param mock - The mock standing in for that level
 * @returns The first argument of each call
 */
function lines(mock: Mock): unknown[] {
  return mock.mock.calls.map(([line]) => line)
}

beforeEach(() => {
  mockBuild.mockReset()
  mockLevel.mockReset()
  mockError.mockReset()
  mockDebug.mockReset()
  mockBuild.mockReturnValue(promiseResolve())
})

describe('buildExecutor', () => {
  it('answers success when the build finishes', async () => {
    await expect(buildExecutor({}, context())).resolves.toEqual({ success: true })
  })

  it('builds the project with what the executor decides for every workspace', async () => {
    await buildExecutor({}, context())
    expect(builtWith()).toEqual(
      expect.objectContaining({
        projectRoot: join(workspace.path, 'libs/a'),
        workspaceRoot: workspace.path,
        filterWorkspaceDepsFromOutput: true,
        inheritFieldsFrom: { from: join(workspace.path, 'package.json'), fields: ['repository', 'bugs', 'homepage', 'author'] },
        thirdPartyLicenses: true,
        memoryMonitor: { warningMB: 512, criticalMB: 768, growthMB: 50 },
      })
    )
  })

  it('leaves the output path and the tsconfig to the builder unless the options name them', async () => {
    await buildExecutor({}, context())
    const { outputPath, tsConfig } = builtWith()
    expect({ outputPath, tsConfig }).toEqual({ outputPath: undefined, tsConfig: undefined })
  })

  it('resolves the output path and the tsconfig the options name against the workspace root', async () => {
    await buildExecutor({ outputPath: 'out/a', tsConfig: 'libs/a/tsconfig.custom.json' }, context())
    const { outputPath, tsConfig } = builtWith()
    expect({ outputPath, tsConfig }).toEqual({
      outputPath: join(workspace.path, 'out/a'),
      tsConfig: join(workspace.path, 'libs/a/tsconfig.custom.json'),
    })
  })

  it('counts as first-party the packages of the projects of the workspace', async () => {
    await buildExecutor({}, context())
    const { isWorkspacePackage } = builtWith()
    expect(['@fixture/a', '@fixture/b', '@other/c'].filter((name) => isWorkspacePackage?.(name))).toEqual(['@fixture/a', '@fixture/b'])
  })

  it('copies the project README and changelog alone when the options name no assets', async () => {
    await buildExecutor({}, context())
    expect(builtWith().assets).toEqual([{ from: join(workspace.path, 'libs/a'), files: ['README.md', 'CHANGELOG.md'] }])
  })

  it('copies the root assets that exist and the assets the options add, after the project files', async () => {
    const extra = { from: 'libs/a/docs', files: ['guide.md'] }
    await buildExecutor({ rootAssets: ['LICENSE', 'NOTICE'], assets: [extra] }, context())
    expect(builtWith().assets).toEqual([
      { from: join(workspace.path, 'libs/a'), files: ['README.md', 'CHANGELOG.md'] },
      { from: workspace.path, files: ['LICENSE'] },
      extra,
    ])
  })

  it('passes the format and output options through unchanged', async () => {
    const options = {
      external: ['react'],
      esm: { bundleWorkspaceDeps: true },
      cjs: { bundleWorkspaceDeps: true },
      iife: { entry: '.', globalName: 'Acme' },
      umd: { entry: '.', globalName: 'Acme' },
      unpkg: './umd/index.js',
      jsdelivr: './iife/index.js',
      bin: [{ name: 'acme', entry: './src/bin.ts' }],
      dedupeSharedInternals: false,
      verbose: true,
      clean: false,
    }
    await buildExecutor(options as never, context())
    expect(builtWith()).toEqual(expect.objectContaining(options))
  })

  it.each([
    [true, 'debug'],
    [false, 'log'],
    [undefined, 'log'],
  ])('logs with verbose %s at the level %s', async (verbose, level) => {
    await buildExecutor({ verbose }, context())
    expect(mockLevel.mock.calls).toEqual([[level]])
  })

  it.each([
    ['names no project', { projectName: '' }, 'Project name is required'],
    ['names a project the workspace does not have', { projectName: 'lib-absent' }, 'Could not find project configuration for lib-absent'],
  ])('refuses a task that %s', async (_, difference, message) => {
    const result = await buildExecutor({}, { ...context(), ...difference })
    expect({ result, errors: lines(mockError), builds: mockBuild.mock.calls.length }).toEqual({
      result: { success: false },
      errors: [message],
      builds: 0,
    })
  })

  it('reports a failed build with the error and keeps its stack for the debug log', async () => {
    const error = createError('rollup broke')
    mockBuild.mockReturnValue(promiseReject(error))
    const result = await buildExecutor({}, context())
    expect({ result, errors: lines(mockError), debug: lines(mockDebug) }).toEqual({
      result: { success: false },
      errors: ['Failed to build lib-a', 'Error: rollup broke'],
      debug: [`Stack trace:\n${error.stack}`],
    })
  })

  it('reports an error without a stack, with nothing for the debug log', async () => {
    const error = createError('no stack')
    delete error.stack
    mockBuild.mockReturnValue(promiseReject(error))
    const result = await buildExecutor({}, context())
    expect({ result, errors: lines(mockError), debug: lines(mockDebug) }).toEqual({
      result: { success: false },
      errors: ['Failed to build lib-a', 'Error: no stack'],
      debug: [],
    })
  })

  it('reports a thrown value that is no error as text', async () => {
    mockBuild.mockReturnValue(promiseReject('out of memory'))
    const result = await buildExecutor({}, context())
    expect({ result, errors: lines(mockError) }).toEqual({
      result: { success: false },
      errors: ['Failed to build lib-a', 'out of memory'],
    })
  })
})
