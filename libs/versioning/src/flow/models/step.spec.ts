import type { FlowContext, FlowStepResult } from './types'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFailedResult, createNoopStep, createSkippedResult, createStep, createSuccessResult } from './step'

function createMockContext(): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: '@test/pkg',
    tree: {} as FlowContext['tree'],
    registry: {} as FlowContext['registry'],
    git: {} as FlowContext['git'],
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
    } as unknown as FlowContext['logger'],
    config: { preset: 'conventional' },
    state: {},
  }
}

describe('Flow Step Model', () => {
  describe('createStep', () => {
    it('creates a step with required properties', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute)

      expect(step.id).toBe('test-id')
      expect(step.name).toBe('Test Step')
      expect(step.execute).toBe(execute)
    })

    it('creates a step with optional description', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute, {
        description: 'A test step that does things',
      })

      expect(step.description).toBe('A test step that does things')
    })

    it('creates a step with skipIf condition', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const skipIf = jest.fn().mockReturnValue(true)
      const step = createStep('test-id', 'Test Step', execute, { skipIf })

      expect(step.skipIf).toBe(skipIf)

      const ctx = createMockContext()
      expect(step.skipIf?.(ctx)).toBe(true)
      expect(skipIf).toHaveBeenCalledWith(ctx)
    })

    it('creates a step with continueOnError flag', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute, {
        continueOnError: true,
      })

      expect(step.continueOnError).toBe(true)
    })

    it('creates a step with dependsOn array', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute, {
        dependsOn: ['step-1', 'step-2'],
      })

      expect(step.dependsOn).toEqual(['step-1', 'step-2'])
    })

    it('creates a step with all options combined', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const skipIf = jest.fn().mockReturnValue(false)
      const step = createStep('full-step', 'Full Step', execute, {
        description: 'A fully configured step',
        skipIf,
        continueOnError: true,
        dependsOn: ['dep-1', 'dep-2', 'dep-3'],
      })

      expect(step.id).toBe('full-step')
      expect(step.name).toBe('Full Step')
      expect(step.execute).toBe(execute)
      expect(step.description).toBe('A fully configured step')
      expect(step.skipIf).toBe(skipIf)
      expect(step.continueOnError).toBe(true)
      expect(step.dependsOn).toEqual(['dep-1', 'dep-2', 'dep-3'])
    })

    it('creates a step with empty options object', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute, {})

      expect(step.id).toBe('test-id')
      expect(step.name).toBe('Test Step')
      expect(step.description).toBeUndefined()
      expect(step.skipIf).toBeUndefined()
      expect(step.continueOnError).toBeUndefined()
      expect(step.dependsOn).toBeUndefined()
    })

    it('executes the step function correctly', async () => {
      const expectedResult: FlowStepResult = {
        status: 'success',
        message: 'Done!',
        stateUpdates: { currentVersion: '1.0.0' },
      }
      const execute = jest.fn().mockResolvedValue(expectedResult)
      const step = createStep('test-id', 'Test Step', execute)

      const ctx = createMockContext()
      const result = await step.execute(ctx)

      expect(execute).toHaveBeenCalledWith(ctx)
      expect(result).toEqual(expectedResult)
    })
  })

  describe('createNoopStep', () => {
    it('creates a step with default message', async () => {
      const step = createNoopStep('noop-id', 'Noop Step')

      expect(step.id).toBe('noop-id')
      expect(step.name).toBe('Noop Step')

      const ctx = createMockContext()
      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toBe('Step completed (no-op)')
    })

    it('creates a step with custom message', async () => {
      const step = createNoopStep('noop-id', 'Noop Step', 'Custom completion message')

      const ctx = createMockContext()
      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toBe('Custom completion message')
    })

    it('always returns success status', async () => {
      const step = createNoopStep('always-success', 'Always Success')

      const ctx = createMockContext()
      const result1 = await step.execute(ctx)
      const result2 = await step.execute(ctx)

      expect(result1.status).toBe('success')
      expect(result2.status).toBe('success')
    })
  })

  describe('createSkippedResult', () => {
    it('creates a skipped result with message', () => {
      const result = createSkippedResult('Skipped because of condition')

      expect(result.status).toBe('skipped')
      expect(result.message).toBe('Skipped because of condition')
    })

    it('creates a skipped result with empty message', () => {
      const result = createSkippedResult('')

      expect(result.status).toBe('skipped')
      expect(result.message).toBe('')
    })
  })

  describe('createSuccessResult', () => {
    it('creates a success result with message only', () => {
      const result = createSuccessResult('Operation completed successfully')

      expect(result.status).toBe('success')
      expect(result.message).toBe('Operation completed successfully')
      expect(result.stateUpdates).toBeUndefined()
    })

    it('creates a success result with state updates', () => {
      const result = createSuccessResult('Version calculated', {
        nextVersion: '2.0.0',
        bumpType: 'major',
      })

      expect(result.status).toBe('success')
      expect(result.message).toBe('Version calculated')
      expect(result.stateUpdates).toEqual({
        nextVersion: '2.0.0',
        bumpType: 'major',
      })
    })

    it('creates a success result with empty state updates', () => {
      const result = createSuccessResult('Done', {})

      expect(result.status).toBe('success')
      expect(result.stateUpdates).toEqual({})
    })
  })

  describe('createFailedResult', () => {
    it('creates a failed result with error', () => {
      const error = new Error('Something went wrong')
      const result = createFailedResult(error)

      expect(result.status).toBe('failed')
      expect(result.error).toBe(error)
      expect(result.message).toBe('Something went wrong')
    })

    it('creates a failed result with custom message', () => {
      const error = new Error('Original error message')
      const result = createFailedResult(error, 'Custom failure message')

      expect(result.status).toBe('failed')
      expect(result.error).toBe(error)
      expect(result.message).toBe('Custom failure message')
    })

    it('uses error message when custom message is undefined', () => {
      const error = new Error('Error from exception')
      const result = createFailedResult(error, undefined)

      expect(result.status).toBe('failed')
      expect(result.message).toBe('Error from exception')
    })

    it('handles errors with empty message', () => {
      const error = new Error('')
      const result = createFailedResult(error)

      expect(result.status).toBe('failed')
      expect(result.error).toBe(error)
      expect(result.message).toBe('')
    })
  })
})
