import type { MockFileChange } from './__test-utils__/mocks'
import { beforeEach } from 'node:test'
import * as projectScopeNx from '@hyperfrontend/project-scope/nx'
import * as projectScopeVfs from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as workspaceDiscovery from '../../workspace/discovery'
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

beforeEach(() => {
  jest.clearAllMocks()
  projectScopeNx.isNxWorkspace.mockReturnValue(false)
  projectScopeNx.discoverNxProjects.mockReturnValue(new Map())
  workspaceDiscovery.discoverProjectByName.mockReturnValue(null)
  projectScopeVfs.commitChanges.mockImplementation(() => void 0)
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

    expect(projectScopeVfs.commitChanges).toHaveBeenCalledWith(tree, { verbose: undefined })
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

    expect(projectScopeVfs.commitChanges).toHaveBeenCalledWith(tree, { verbose: true })
  })

  it('logs error when commitChanges throws but does not fail the flow', async () => {
    projectScopeVfs.commitChanges.mockImplementation(() => {
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

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to commit file changes'))
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

    expect(projectScopeVfs.commitChanges).not.toHaveBeenCalled()
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

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      dryRun: false,
    })

    expect(projectScopeVfs.commitChanges).not.toHaveBeenCalled()
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

    expect(logger.info).toHaveBeenCalledWith('Pending changes: 1 file(s)')
    expect(logger.info).toHaveBeenCalledWith('  [UPDATE] libs/test/package.json')
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

    expect(projectScopeVfs.commitChanges).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('Dry run - would modify 2 file(s):')
    expect(logger.info).toHaveBeenCalledWith('  [UPDATE] libs/test/package.json')
    expect(logger.info).toHaveBeenCalledWith('  [CREATE] libs/test/CHANGELOG.md')
  })
})

describe('executeFlow - rollbackOnFailure option', () => {
  beforeEach(() => {
    projectScopeVfs.rollbackChanges.mockClear()
  })

  it('calls rollbackChanges when step returns failed status and rollbackOnFailure is default (true)', async () => {
    const logger = createMockLogger()
    const failStep = createStep('fail', 'Fail', async () => ({
      status: 'failed' as const,
      message: 'Step failed',
    }))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep],
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

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('failed')
    expect(projectScopeVfs.rollbackChanges).toHaveBeenCalledWith(tree)
    expect(logger.warn).toHaveBeenCalledWith('Rolling back 1 pending file change(s)')
  })

  it('calls rollbackChanges when step throws and rollbackOnFailure is default (true)', async () => {
    const logger = createMockLogger()
    const throwStep = createStep('throw', 'Throw', async () => {
      throw new Error('Intentional error')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [throwStep],
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

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('failed')
    expect(projectScopeVfs.rollbackChanges).toHaveBeenCalledWith(tree)
    expect(logger.warn).toHaveBeenCalledWith('Rolling back 2 pending file change(s)')
  })

  it('does not call rollbackChanges when rollbackOnFailure is false', async () => {
    const logger = createMockLogger()
    const failStep = createStep('fail', 'Fail', async () => ({
      status: 'failed' as const,
      message: 'Step failed',
    }))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep],
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

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      rollbackOnFailure: false,
    })

    expect(result.status).toBe('failed')
    expect(projectScopeVfs.rollbackChanges).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Rolling back'))
  })

  it('does not call rollbackChanges when step has continueOnError: true', async () => {
    const logger = createMockLogger()
    const failStep = createStep(
      'fail',
      'Fail',
      async () => ({
        status: 'failed' as const,
        message: 'Step failed',
      }),
      { continueOnError: true }
    )
    const successStep = createStep('success', 'Success', async () => createSuccessResult('OK'))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep, successStep],
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

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('partial')
    expect(projectScopeVfs.rollbackChanges).not.toHaveBeenCalled()
  })

  it('does not call rollbackChanges when there are no pending changes', async () => {
    const logger = createMockLogger()
    const failStep = createStep('fail', 'Fail', async () => ({
      status: 'failed' as const,
      message: 'Step failed',
    }))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep],
    }

    const tree = createMockTree(
      {
        '/workspace/libs/test/package.json': JSON.stringify({
          name: '@test/pkg',
          version: '1.0.0',
        }),
      },
      []
    )

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('failed')
    expect(projectScopeVfs.rollbackChanges).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Rolling back'))
  })

  it('does not call rollbackChanges when flow succeeds', async () => {
    const logger = createMockLogger()
    const successStep = createStep('success', 'Success', async () => createSuccessResult('OK'))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [successStep],
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

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('success')
    expect(projectScopeVfs.rollbackChanges).not.toHaveBeenCalled()
  })

  it('calls rollbackChanges when explicitly set to true', async () => {
    const logger = createMockLogger()
    const failStep = createStep('fail', 'Fail', async () => ({
      status: 'failed' as const,
      message: 'Step failed',
    }))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep],
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

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      rollbackOnFailure: true,
    })

    expect(result.status).toBe('failed')
    expect(projectScopeVfs.rollbackChanges).toHaveBeenCalledWith(tree)
  })
})
