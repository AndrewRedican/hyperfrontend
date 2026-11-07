import type { Mock } from '@hyperfrontend/testing'
import type { ExecutorContext } from '../../runner/contract'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { logger } from '../shared/logger'
import { resolveFromWorkspace } from '../shared/workspace'
import { typecheckExecutor } from './executor'

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }))
jest.mock('../shared/workspace', () => ({ resolveFromWorkspace: jest.fn() }))
jest.mock('../shared/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }))

const mockExec = execFileSync as Mock
const mockResolve = resolveFromWorkspace as Mock
const mockInfo = logger.info as Mock
const mockError = logger.error as Mock

/** Where the workspace of these cases resolves the compiler. */
const TSC = '/installed/typescript/bin/tsc'

const workspace = useTempDir({
  prefix: 'typecheck-executor-',
  tree: {
    'libs/a/tsconfig.lib.json': '{}\n',
    'libs/a/tsconfig.spec.json': '{}\n',
    'libs/b/tsconfig.lib.json': '{}\n',
    'libs/b/tsconfig.custom.json': '{}\n',
    'libs/b/tsconfig.custom-spec.json': '{}\n',
    'libs/none/keep.txt': '',
  },
})

/**
 * The context of a typecheck task of a project of the temporary workspace.
 *
 * @param projectName - The project the task runs on
 * @returns The context, with the project `lib-a` at `libs/a` and `lib-b` at `libs/b`
 */
function context(projectName = 'lib-a'): ExecutorContext {
  return {
    root: workspace.path,
    cwd: workspace.path,
    projectName,
    targetName: 'typecheck',
    target: {},
    projects: { 'lib-a': { root: 'libs/a' }, 'lib-b': { root: 'libs/b' }, 'lib-none': { root: 'libs/none' } },
    configuration: {},
  }
}

/**
 * The configuration each compiler run was given, in order.
 *
 * @returns The value of `-p` of every run
 */
function checkedConfigs(): unknown[] {
  return mockExec.mock.calls.map(([, args]) => (args as readonly string[]).at(-1))
}

/**
 * Every line logged as an error, in order.
 *
 * @returns The lines
 */
function errors(): unknown[] {
  return mockError.mock.calls.map(([line]) => line)
}

beforeEach(() => {
  mockExec.mockReset()
  mockResolve.mockReset()
  mockInfo.mockReset()
  mockError.mockReset()
  mockResolve.mockReturnValue(TSC)
})

describe('typecheckExecutor', () => {
  it('runs the compiler the workspace resolves on the current Node binary, emitting nothing, from the workspace root', async () => {
    await typecheckExecutor({}, context('lib-b'))
    expect(mockExec.mock.calls).toEqual([
      [
        process.execPath,
        [TSC, '--noEmit', '-p', join(workspace.path, 'libs/b/tsconfig.lib.json')],
        { cwd: workspace.path, stdio: 'inherit', encoding: 'utf-8' },
      ],
    ])
  })

  it('resolves the compiler from the workspace root', async () => {
    await typecheckExecutor({}, context())
    expect(mockResolve.mock.calls).toEqual([[workspace.path, 'typescript/bin/tsc']])
  })

  it('checks the library configuration, then the spec configuration a project has beside it', async () => {
    await typecheckExecutor({}, context())
    expect(checkedConfigs()).toEqual([join(workspace.path, 'libs/a/tsconfig.lib.json'), join(workspace.path, 'libs/a/tsconfig.spec.json')])
  })

  it('checks the library configuration alone for a project without a spec configuration', async () => {
    await typecheckExecutor({}, context('lib-b'))
    expect(checkedConfigs()).toEqual([join(workspace.path, 'libs/b/tsconfig.lib.json')])
  })

  it('checks the configurations the options name, relative to the workspace root', async () => {
    await typecheckExecutor({ tsConfig: 'libs/b/tsconfig.custom.json', specTsConfig: 'libs/b/tsconfig.custom-spec.json' }, context('lib-b'))
    expect(checkedConfigs()).toEqual([
      join(workspace.path, 'libs/b/tsconfig.custom.json'),
      join(workspace.path, 'libs/b/tsconfig.custom-spec.json'),
    ])
  })

  it('answers success when every configuration checks', async () => {
    await expect(typecheckExecutor({}, context())).resolves.toEqual({ success: true })
  })

  it('logs each configuration it uses and that the check passed', async () => {
    await typecheckExecutor({}, context('lib-b'))
    expect(mockInfo.mock.calls.map(([line]) => line)).toEqual([
      'Type checking lib-b...',
      `  Using config: ${join(workspace.path, 'libs/b/tsconfig.lib.json')}`,
      'Type check passed for lib-b',
    ])
  })

  it('checks every configuration even after one fails', async () => {
    mockExec.mockImplementationOnce(() => {
      throw createError('exit 2')
    })
    await typecheckExecutor({}, context())
    expect(mockExec).toHaveBeenCalledTimes(2)
  })

  it('answers failure when one configuration fails', async () => {
    mockExec.mockImplementationOnce(() => {
      throw createError('exit 2')
    })
    await expect(typecheckExecutor({}, context())).resolves.toEqual({ success: false })
  })

  it('logs which configuration failed and that the project failed', async () => {
    mockExec.mockImplementationOnce(() => {
      throw createError('exit 2')
    })
    await typecheckExecutor({}, context())
    expect(errors()).toEqual([
      `  Type check failed for config: ${join(workspace.path, 'libs/a/tsconfig.lib.json')}`,
      'Type check failed for lib-a',
    ])
  })

  it.each([
    ['names no project', {}, { projectName: '' }, 'No project name provided'],
    [
      'names a project the workspace does not have',
      {},
      { projectName: 'lib-absent' },
      'Could not find project configuration for lib-absent',
    ],
  ])('refuses a task that %s', async (_, options, difference, message) => {
    const result = await typecheckExecutor(options, { ...context(), ...difference })
    expect({ result, errors: errors(), runs: mockExec.mock.calls.length }).toEqual({
      result: { success: false },
      errors: [message],
      runs: 0,
    })
  })

  it('refuses a project without its library configuration, naming the path', async () => {
    const result = await typecheckExecutor({}, context('lib-none'))
    expect({ result, errors: errors(), runs: mockExec.mock.calls.length }).toEqual({
      result: { success: false },
      errors: [`TypeScript config not found: ${join(workspace.path, 'libs/none/tsconfig.lib.json')}`],
      runs: 0,
    })
  })

  it('refuses a spec configuration the options name that does not exist, naming the path', async () => {
    const result = await typecheckExecutor({ specTsConfig: 'libs/a/tsconfig.absent.json' }, context())
    expect({ result, errors: errors(), runs: mockExec.mock.calls.length }).toEqual({
      result: { success: false },
      errors: [`TypeScript spec config not found: ${join(workspace.path, 'libs/a/tsconfig.absent.json')}`],
      runs: 0,
    })
  })

  it('refuses a workspace without the compiler, naming the workspace and the remedy', async () => {
    mockResolve.mockReturnValue(null)
    const result = await typecheckExecutor({}, context())
    expect({ result, errors: errors(), runs: mockExec.mock.calls.length }).toEqual({
      result: { success: false },
      errors: [`TypeScript compiler not found from: ${workspace.path}`, 'Please run npm install to ensure TypeScript is installed.'],
      runs: 0,
    })
  })
})
