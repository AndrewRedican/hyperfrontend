import type { FlowContext } from '../models/types'
import { beforeEach } from 'node:test'
import * as projectScopeNx from '@hyperfrontend/project-scope/nx'
import * as projectScopeVfs from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as workspaceDiscovery from '../../workspace/discovery'
import { createSkippedResult, createStep, createSuccessResult } from '../models/step'
import { createMinimalFlow } from '../presets/conventional'
import { createMockGitClient, createMockRegistry, createMockTree } from './__test-utils__/mocks'
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

describe('executeFlow - buildSummary behavior', () => {
  it('includes version transition in summary when nextVersion is set', async () => {
    const flow = createMinimalFlow({ dryRun: true, skipGit: true })
    const tree = createMockTree({
      '/workspace/libs/test/package.json': JSON.stringify({
        name: '@test/pkg',
        version: '1.0.0',
      }),
    })

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry('1.0.0'),
      git: createMockGitClient([{ type: 'feat', subject: 'feature' }]),
      projectRoot: 'libs/test',
    })

    expect(result.summary).toContain('→')
  })

  it('shows "No release needed" when bumpType is none and status is success', async () => {
    const noBumpStep = createStep('no-bump', 'No Bump', async () =>
      createSuccessResult('Done', {
        bumpType: 'none',
      })
    )

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [noBumpStep],
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
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('success')
    expect(result.state.bumpType).toBe('none')
    expect(result.summary).toContain('No release needed')
  })

  it('shows step counts in summary', async () => {
    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK'))
    const step2 = createStep('step2', 'Step 2', async () => createSkippedResult('Skipped'))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [step1, step2],
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
      projectRoot: 'libs/test',
    })

    expect(result.summary).toContain('1 completed')
    expect(result.summary).toContain('1 skipped')
    expect(result.summary).toContain('0 failed')
  })
})

describe('executeFlow - flow status determination', () => {
  it('returns "skipped" status when all steps are skipped', async () => {
    const skipStep1 = createStep('skip1', 'Skip 1', async () => createSuccessResult('OK'), {
      skipIf: () => true,
    })
    const skipStep2 = createStep('skip2', 'Skip 2', async () => createSuccessResult('OK'), {
      skipIf: () => true,
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [skipStep1, skipStep2],
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
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('skipped')
  })

  it('returns "partial" status when some steps fail with continueOnError', async () => {
    const failStep = createStep(
      'fail',
      'Fail',
      async () => ({
        status: 'failed' as const,
        message: 'Failed',
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
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('partial')
  })

  it('returns "success" status when all steps succeed', async () => {
    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK'))
    const step2 = createStep('step2', 'Step 2', async () => createSuccessResult('OK'))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [step1, step2],
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
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('success')
  })

  it('returns "failed" status when a step throws and continueOnError is false', async () => {
    const failStep = createStep('fail', 'Fail', async () => {
      throw new Error('Boom')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep],
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
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('failed')
  })
})

describe('executeFlow - step dependencies', () => {
  it('skips step when dependency step did not succeed', async () => {
    const failStep = createStep(
      'first',
      'First',
      async () => ({
        status: 'failed' as const,
        message: 'Failed',
      }),
      { continueOnError: true }
    )

    const dependentStep = createStep('dependent', 'Dependent', async () => createSuccessResult('Should not run'), { dependsOn: ['first'] })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [failStep, dependentStep],
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
      projectRoot: 'libs/test',
    })

    const depResult = result.steps.find((s) => s.stepId === 'dependent')
    expect(depResult?.status).toBe('skipped')
    expect(depResult?.message).toBe('Dependencies not met')
  })

  it('executes step when all dependencies succeed', async () => {
    const firstStep = createStep('first', 'First', async () => createSuccessResult('OK'))
    const dependentStep = createStep('dependent', 'Dependent', async () => createSuccessResult('Ran after first'), { dependsOn: ['first'] })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [firstStep, dependentStep],
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
      projectRoot: 'libs/test',
    })

    const depResult = result.steps.find((s) => s.stepId === 'dependent')
    expect(depResult?.status).toBe('success')
  })
})

describe('executeFlow - state accumulation', () => {
  it('accumulates state updates from multiple steps', async () => {
    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK', { currentVersion: '1.0.0' }))
    const step2 = createStep('step2', 'Step 2', async () => createSuccessResult('OK', { nextVersion: '1.1.0' }))
    const step3 = createStep('step3', 'Step 3', async () => createSuccessResult('OK', { bumpType: 'minor' as const }))

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [step1, step2, step3],
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
      projectRoot: 'libs/test',
    })

    expect(result.state.currentVersion).toBe('1.0.0')
    expect(result.state.nextVersion).toBe('1.1.0')
    expect(result.state.bumpType).toBe('minor')
  })

  it('later steps can access state from earlier steps', async () => {
    let capturedState: Record<string, unknown> | undefined

    const step1 = createStep('step1', 'Step 1', async () => createSuccessResult('OK', { myValue: 'hello' }))
    const step2 = createStep('step2', 'Step 2', async (ctx: FlowContext) => {
      capturedState = { ...ctx.state }
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [step1, step2],
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
      projectRoot: 'libs/test',
    })

    expect(capturedState?.['myValue']).toBe('hello')
  })
})

describe('executeFlow - error handling', () => {
  it('converts non-Error throws to Error objects', async () => {
    const throwStringStep = createStep('throw-string', 'Throw String', async () => {
      throw 'string error'
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [throwStringStep],
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
      projectRoot: 'libs/test',
    })

    expect(result.status).toBe('failed')
    const failedStep = result.steps.find((s) => s.stepId === 'throw-string')
    expect(failedStep?.error).toBeInstanceOf(Error)
    expect(failedStep?.message).toBe('string error')
  })
})

describe('executeFlow - timing', () => {
  it('returns duration in milliseconds', async () => {
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

    const result = await executeFlow(flow, 'lib-test', '/workspace', {
      tree,
      registry: createMockRegistry(),
      git: createMockGitClient(),
      projectRoot: 'libs/test',
    })

    expect(typeof result.duration).toBe('number')
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})

describe('executeFlow - buildSummary edge cases', () => {
  it('shows "?.?.?" when currentVersion is undefined but nextVersion is set', async () => {
    const setNextVersionStep = createStep('set-next', 'Set Next', async () =>
      createSuccessResult('OK', {
        nextVersion: '2.0.0',
      })
    )

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [setNextVersionStep],
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
      projectRoot: 'libs/test',
    })

    expect(result.summary).toContain('?.?.?')
    expect(result.summary).toContain('2.0.0')
  })

  it('shows failed count in summary when steps fail with continueOnError', async () => {
    const failStep = createStep(
      'fail',
      'Fail',
      async () => ({
        status: 'failed' as const,
        message: 'Failed',
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
      projectRoot: 'libs/test',
    })

    expect(result.summary).toContain('1 completed')
    expect(result.summary).toContain('1 failed')
  })
})

describe('executeFlow - continueOnError with throws', () => {
  it('continues to next step when step throws and continueOnError is true', async () => {
    let secondStepRan = false

    const throwStep = createStep(
      'throw',
      'Throw',
      async () => {
        throw new Error('Intentional error')
      },
      { continueOnError: true }
    )

    const secondStep = createStep('second', 'Second', async () => {
      secondStepRan = true
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [throwStep, secondStep],
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
      projectRoot: 'libs/test',
    })

    expect(secondStepRan).toBe(true)
    expect(result.status).toBe('partial')
    expect(result.steps[0].status).toBe('failed')
    expect(result.steps[1].status).toBe('success')
  })

  it('stops execution when step throws and continueOnError is false', async () => {
    let secondStepRan = false

    const throwStep = createStep('throw', 'Throw', async () => {
      throw new Error('Intentional error')
    })

    const secondStep = createStep('second', 'Second', async () => {
      secondStepRan = true
      return createSuccessResult('OK')
    })

    const flow = {
      id: 'test',
      name: 'Test Flow',
      config: { dryRun: true },
      steps: [throwStep, secondStep],
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
      projectRoot: 'libs/test',
    })

    expect(secondStepRan).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.steps).toHaveLength(1)
  })
})
