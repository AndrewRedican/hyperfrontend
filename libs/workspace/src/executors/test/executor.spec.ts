import type { Mock } from '@hyperfrontend/testing'
import type { ExecutorContext } from '../../runner/contract'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { spawnSyncResult } from '@hyperfrontend/testing/process'
import { resolveFromWorkspace } from '../shared/workspace'
import { testExecutor } from './executor'
jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('../shared/workspace', () => ({ resolveFromWorkspace: jest.fn() }))

const mockSpawn = spawnSync as Mock
const mockResolve = resolveFromWorkspace as Mock

/** Where the workspace of these cases resolves the test runtime's hooks and this package's runner. */
const RESOLVED: Readonly<Record<string, string>> = {
  '@hyperfrontend/testing/hooks': '/installed/testing/hooks.mjs',
  '@hyperfrontend/workspace/executors/test': '/installed/workspace/executors/test/index.mjs',
}

beforeEach(() => {
  mockSpawn.mockReset()
  mockResolve.mockReset()
  mockResolve.mockImplementation((_root: string, specifier: string) => RESOLVED[specifier] ?? null)
})

const workspace = useTempDir({ prefix: 'test-executor-', tree: { 'libs/a/test.config.ts': 'export default {}\n' } })

/**
 * The context of a test task of the library at `libs/a`.
 *
 * @returns The context, rooted at the temporary workspace
 */
function context(): ExecutorContext {
  return {
    root: workspace.path,
    cwd: workspace.path,
    projectName: 'lib-a',
    targetName: 'test',
    target: {},
    projects: { 'lib-a': { root: 'libs/a' } },
    configuration: {},
  }
}

describe('testExecutor', () => {
  it('preloads the hooks of the test runtime the workspace resolves, then runs the runner of this package on the task', async () => {
    mockSpawn.mockReturnValueOnce(spawnSyncResult())
    await testExecutor({}, context())
    expect(mockSpawn.mock.calls[0]?.[1]).toEqual([
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      '--import',
      pathToFileURL('/installed/testing/hooks.mjs').href,
      '--input-type=module',
      '--eval',
      expect.stringContaining('runTestsCli'),
      pathToFileURL('/installed/workspace/executors/test/index.mjs').href,
      workspace.path,
      join(workspace.path, 'libs/a'),
      join(workspace.path, 'coverage', 'libs/a'),
      join(workspace.path, 'libs/a', 'test.config.ts'),
    ])
  })

  it('takes the test configuration and the coverage directory the options name', async () => {
    workspace.write('configs/a.test.config.ts', 'export default {}\n')
    mockSpawn.mockReturnValueOnce(spawnSyncResult())
    await testExecutor({ testConfig: 'configs/a.test.config.ts', coverageDirectory: 'out/coverage' }, context())
    expect((mockSpawn.mock.calls[0]?.[1] as string[]).slice(-2)).toEqual([
      join(workspace.path, 'out/coverage'),
      join(workspace.path, 'configs/a.test.config.ts'),
    ])
  })

  it('reports success when the runner exits cleanly', async () => {
    mockSpawn.mockReturnValueOnce(spawnSyncResult())
    expect(await testExecutor({}, context())).toEqual({ success: true })
  })

  it('reports failure when the runner exits with a failure', async () => {
    mockSpawn.mockReturnValueOnce(spawnSyncResult({ status: 1 }))
    expect(await testExecutor({}, context())).toEqual({ success: false })
  })

  it.each([
    ['names no project', { projectName: '' }],
    ['names a project the workspace does not have', { projectName: 'lib-absent' }],
    ['has no test configuration', { projects: { 'lib-a': { root: 'libs/none' } } }],
  ])('fails without starting the runner for a task that %s', async (_, difference) => {
    await testExecutor({}, { ...context(), ...difference })
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it.each(['@hyperfrontend/testing/hooks', '@hyperfrontend/workspace/executors/test'])(
    'fails without starting the runner where the workspace cannot resolve %s',
    async (missing) => {
      mockResolve.mockImplementation((_root: string, specifier: string) => (specifier === missing ? null : RESOLVED[specifier]))
      await testExecutor({}, context())
      expect(mockSpawn).not.toHaveBeenCalled()
    }
  )
})
