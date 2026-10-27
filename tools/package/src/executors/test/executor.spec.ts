import type { ExecutorContext } from '@hyperfrontend/integration-nx/compat'
import type { Mock } from '@hyperfrontend/testing'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { spawnSyncResult } from '@hyperfrontend/testing/process'
import testExecutor from './executor'
jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }))

const mockSpawn = spawnSync as Mock

beforeEach(() => mockSpawn.mockReset())

const workspace = useTempDir({
  prefix: 'test-executor-',
  tree: {
    'tsconfig.base.json': { compilerOptions: { paths: { '@hyperfrontend/testing/hooks': ['libs/testing/src/hooks/index.ts'] } } },
    'libs/a/test.config.ts': 'export default {}\n',
  },
})

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
    projectsConfigurations: { version: 2, projects: { 'lib-a': { root: 'libs/a' } } },
    nxJsonConfiguration: {},
    projectGraph: { nodes: {}, dependencies: {} },
    isVerbose: false,
  }
}

describe('testExecutor', () => {
  it('starts the runner entry of the workspace the task runs in', async () => {
    mockSpawn.mockReturnValueOnce(spawnSyncResult())
    await testExecutor({}, context())
    expect(mockSpawn.mock.calls[0]?.[1]).toContain(join(workspace.path, 'tools/package/src/executors/test/runner-cli.ts'))
  })

  it('reports failure when the runner exits with a failure', async () => {
    mockSpawn.mockReturnValueOnce(spawnSyncResult({ status: 1 }))
    expect(await testExecutor({}, context())).toEqual({ success: false })
  })
})
