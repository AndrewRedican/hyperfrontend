import type { MockFileChange } from './__test-utils__/mocks'
import { beforeEach } from 'node:test'
import { discoverNxProjects, isNxWorkspace } from '@hyperfrontend/project-scope/nx'
import { commitChanges } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { discoverProjectByName } from '../../workspace/discovery'
import { createStep, createSuccessResult } from '../models/step'
import { createMockGitClient, createMockLogger, createMockRegistry, createMockTree } from './__test-utils__/mocks'
import { executeFlow } from './execute'

jest.mock('@hyperfrontend/project-scope/nx', () => ({
  isNxWorkspace: jest.fn(),
  discoverNxProjects: jest.fn(),
}))

jest.mock('../../workspace/discovery', () => ({
  discoverProjectByName: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope/vfs', () => ({
  createTree: jest.fn(),
  commitChanges: jest.fn(),
  rollbackChanges: jest.fn(),
  generateAllDiffs: jest.fn(),
  formatUnifiedDiff: jest.fn(),
}))

const discoverNxProjectsMock = jest.mocked(discoverNxProjects)
const isNxWorkspaceMock = jest.mocked(isNxWorkspace)
const commitChangesMock = jest.mocked(commitChanges)
const discoverProjectByNameMock = jest.mocked(discoverProjectByName)

beforeEach(() => {
  jest.clearAllMocks()
  isNxWorkspaceMock.mockReturnValue(false)
  discoverNxProjectsMock.mockReturnValue(new Map())
  discoverProjectByNameMock.mockReturnValue(null)
  commitChangesMock.mockImplementation(() => void 0)
})

describe('executeFlow - VFS commit behavior', () => {
  it('commits VFS changes to disk when dryRun is false and flow succeeds', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(commitChangesMock).toHaveBeenCalledWith(tree, { verbose: undefined })
  })

  it('logs that file changes were committed to disk', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(logger.info).toHaveBeenCalledWith('File changes committed to disk')
  })

  it('commits VFS changes with verbose option when verbose is true', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
      verbose: true,
    })

    expect(commitChangesMock).toHaveBeenCalledWith(tree, { verbose: true })
  })

  it('logs an error when commitChanges throws', async () => {
    commitChangesMock.mockImplementation(() => {
      throw new Error('Filesystem permission denied')
    })

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to commit file changes'))
  })

  it('does not fail the flow when commitChanges throws', async () => {
    commitChangesMock.mockImplementation(() => {
      throw new Error('Filesystem permission denied')
    })

    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(result.status).toBe('success')
  })

  it('does not commit changes when dryRun is true', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(commitChangesMock).not.toHaveBeenCalled()
  })

  it('logs that a dry run writes nothing when there are no changes', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(logger.info).toHaveBeenCalledWith('Dry run mode - no changes to write')
  })

  it('does not commit changes when flow fails', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [
        createStep('fail', 'Fail', async () => {
          throw new Error('Step failed')
        }),
      ],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(commitChangesMock).not.toHaveBeenCalled()
  })

  it('fails the flow when a step throws before any commit', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [
        createStep('fail', 'Fail', async () => {
          throw new Error('Step failed')
        }),
      ],
    }

    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(result.status).toBe('failed')
  })

  it('populates modifiedFiles in result from tree.listChanges()', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [
      { path: 'libs/test/package.json', type: 'UPDATE' },
      { path: 'libs/test/CHANGELOG.md', type: 'UPDATE' },
    ]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(result.modifiedFiles).toEqual([
      { path: 'libs/test/package.json', changeType: 'UPDATE' },
      { path: 'libs/test/CHANGELOG.md', changeType: 'UPDATE' },
    ])
  })

  it('logs pending changes when verbose is true', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: false },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [{ path: 'libs/test/package.json', type: 'UPDATE' }]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      verbose: true,
      projectRoot: 'libs/test',
    })

    expect(logger.info.mock.calls).toEqual(expect.arrayContaining([['Pending changes: 1 file(s)'], ['  [UPDATE] libs/test/package.json']]))
  })

  it('does not commit changes in dry-run mode with pending changes', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [
      { path: 'libs/test/package.json', type: 'UPDATE' },
      { path: 'libs/test/CHANGELOG.md', type: 'CREATE' },
    ]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(commitChangesMock).not.toHaveBeenCalled()
  })

  it('shows would-modify message in dry-run mode with pending changes', async () => {
    const logger = createMockLogger()
    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [createStep('step1', 'Step 1', async () => createSuccessResult('OK'))],
    }

    const mockChanges: MockFileChange[] = [
      { path: 'libs/test/package.json', type: 'UPDATE' },
      { path: 'libs/test/CHANGELOG.md', type: 'CREATE' },
    ]

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      mockChanges
    )

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(logger.info.mock.calls).toEqual(
      expect.arrayContaining([
        ['Dry run - would modify 2 file(s):'],
        ['  [UPDATE] libs/test/package.json'],
        ['  [CREATE] libs/test/CHANGELOG.md'],
      ])
    )
  })
})
