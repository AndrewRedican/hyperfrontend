import type { MockFileChange } from './__test-utils__/mocks'
import { beforeEach } from 'node:test'
import { discoverNxProjects, isNxWorkspace } from '@hyperfrontend/project-scope/nx'
import { commitChanges, rollbackChanges } from '@hyperfrontend/project-scope/vfs'
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
const rollbackChangesMock = jest.mocked(rollbackChanges)
const discoverProjectByNameMock = jest.mocked(discoverProjectByName)

beforeEach(() => {
  jest.clearAllMocks()
  isNxWorkspaceMock.mockReturnValue(false)
  discoverNxProjectsMock.mockReturnValue(new Map())
  discoverProjectByNameMock.mockReturnValue(null)
  commitChangesMock.mockImplementation(() => void 0)
})

describe('executeFlow - rollbackOnFailure option', () => {
  beforeEach(() => {
    rollbackChangesMock.mockClear()
  })

  it('fails the flow when a step returns failed status', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(rollbackChangesMock).toHaveBeenCalledWith(tree)
  })

  it('warns about rolling back the pending change when a step returns failed status', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(logger.warn).toHaveBeenCalledWith('Rolling back 1 pending file change(s)')
  })

  it('fails the flow when a step throws', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(rollbackChangesMock).toHaveBeenCalledWith(tree)
  })

  it('warns about rolling back both pending changes when a step throws', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(logger.warn).toHaveBeenCalledWith('Rolling back 2 pending file change(s)')
  })

  it('fails the flow when a step returns failed status and rollbackOnFailure is false', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      rollbackOnFailure: false,
    })

    expect(rollbackChangesMock).not.toHaveBeenCalled()
  })

  it('does not warn about a rollback when rollbackOnFailure is false', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      rollbackOnFailure: false,
    })

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Rolling back'))
  })

  it('reports a partial flow when a failing step has continueOnError: true', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(rollbackChangesMock).not.toHaveBeenCalled()
  })

  it('fails the flow when a step returns failed status with no pending changes', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(rollbackChangesMock).not.toHaveBeenCalled()
  })

  it('does not warn about a rollback when there are no pending changes', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Rolling back'))
  })

  it('succeeds when the only step succeeds with pending changes', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
    })

    expect(rollbackChangesMock).not.toHaveBeenCalled()
  })

  it('fails the flow when a step returns failed status and rollbackOnFailure is true', async () => {
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

    await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      logger,
      projectRoot: 'libs/test',
      rollbackOnFailure: true,
    })

    expect(rollbackChangesMock).toHaveBeenCalledWith(tree)
  })
})
