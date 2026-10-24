import type { FlowContext, FlowStepResult } from './types'
import { createMock, describe, expect, it, jest } from '@hyperfrontend/testing'
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
    logger: createMock<FlowContext['logger']>(),
    config: { preset: 'conventional' },
    state: {},
  }
}

describe('Flow Step Model', () => {
  describe('createStep', () => {
    it('creates a step with required properties', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute)

      expect(step).toEqual(expect.objectContaining({ id: 'test-id', name: 'Test Step', execute }))
    })

    it('creates a step with optional description', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute, {
        description: 'A test step that does things',
      })

      expect(step.description).toBe('A test step that does things')
    })

    it('stores the skipIf condition on the step', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const skipIf = jest.fn().mockReturnValue(true)
      const step = createStep('test-id', 'Test Step', execute, { skipIf })

      expect(step.skipIf).toBe(skipIf)
    })

    it('returns the condition verdict from skipIf', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const skipIf = jest.fn().mockReturnValue(true)
      const step = createStep('test-id', 'Test Step', execute, { skipIf })

      expect(step.skipIf?.(createMockContext())).toBe(true)
    })

    it('passes the context to the skipIf condition', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const skipIf = jest.fn().mockReturnValue(true)
      const step = createStep('test-id', 'Test Step', execute, { skipIf })
      const ctx = createMockContext()

      step.skipIf?.(ctx)

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

      expect(step).toEqual({
        id: 'full-step',
        name: 'Full Step',
        execute,
        description: 'A fully configured step',
        skipIf,
        continueOnError: true,
        dependsOn: ['dep-1', 'dep-2', 'dep-3'],
      })
    })

    it('creates a step with empty options object', () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute, {})

      expect(step).toStrictEqual({
        id: 'test-id',
        name: 'Test Step',
        execute,
        description: undefined,
        skipIf: undefined,
        continueOnError: undefined,
        dependsOn: undefined,
        requiresDiskFlush: undefined,
      })
    })

    it('passes the context to the step executor', async () => {
      const execute = jest.fn().mockResolvedValue({ status: 'success' })
      const step = createStep('test-id', 'Test Step', execute)
      const ctx = createMockContext()

      await step.execute(ctx)

      expect(execute).toHaveBeenCalledWith(ctx)
    })

    it('resolves with the executor result', async () => {
      const expectedResult: FlowStepResult = {
        status: 'success',
        message: 'Done!',
        stateUpdates: { currentVersion: '1.0.0' },
      }
      const execute = jest.fn().mockResolvedValue(expectedResult)
      const step = createStep('test-id', 'Test Step', execute)

      const result = await step.execute(createMockContext())

      expect(result).toEqual(expectedResult)
    })
  })

  describe('createNoopStep', () => {
    it('creates a step with the given identity', () => {
      const step = createNoopStep('noop-id', 'Noop Step')

      expect(step).toEqual(expect.objectContaining({ id: 'noop-id', name: 'Noop Step' }))
    })

    it('creates a step with default message', async () => {
      const step = createNoopStep('noop-id', 'Noop Step')

      const ctx = createMockContext()
      const result = await step.execute(ctx)

      expect(result).toEqual({ status: 'success', message: 'Step completed (no-op)' })
    })

    it('creates a step with custom message', async () => {
      const step = createNoopStep('noop-id', 'Noop Step', 'Custom completion message')

      const ctx = createMockContext()
      const result = await step.execute(ctx)

      expect(result).toEqual({ status: 'success', message: 'Custom completion message' })
    })

    it('always returns success status', async () => {
      const step = createNoopStep('always-success', 'Always Success')

      const ctx = createMockContext()
      const result1 = await step.execute(ctx)
      const result2 = await step.execute(ctx)

      expect([result1.status, result2.status]).toEqual(['success', 'success'])
    })
  })

  describe('createSkippedResult', () => {
    it('creates a skipped result with message', () => {
      const result = createSkippedResult('Skipped because of condition')

      expect(result).toEqual({ status: 'skipped', message: 'Skipped because of condition' })
    })

    it('creates a skipped result with empty message', () => {
      const result = createSkippedResult('')

      expect(result).toEqual({ status: 'skipped', message: '' })
    })
  })

  describe('createSuccessResult', () => {
    it('creates a success result with message only', () => {
      const result = createSuccessResult('Operation completed successfully')

      expect(result).toStrictEqual({ status: 'success', message: 'Operation completed successfully', stateUpdates: undefined })
    })

    it('creates a success result with state updates', () => {
      const result = createSuccessResult('Version calculated', {
        nextVersion: '2.0.0',
        bumpType: 'major',
      })

      expect(result).toEqual({
        status: 'success',
        message: 'Version calculated',
        stateUpdates: {
          nextVersion: '2.0.0',
          bumpType: 'major',
        },
      })
    })

    it('creates a success result with empty state updates', () => {
      const result = createSuccessResult('Done', {})

      expect(result).toEqual({ status: 'success', message: 'Done', stateUpdates: {} })
    })
  })

  describe('createFailedResult', () => {
    it('creates a failed result with error', () => {
      const error = new Error('Something went wrong')
      const result = createFailedResult(error)

      expect(result).toEqual({ status: 'failed', error, message: 'Something went wrong' })
    })

    it('keeps the original error object on the result', () => {
      const error = new Error('Something went wrong')
      const result = createFailedResult(error)

      expect(result.error).toBe(error)
    })

    it('creates a failed result with custom message', () => {
      const error = new Error('Original error message')
      const result = createFailedResult(error, 'Custom failure message')

      expect(result).toEqual({ status: 'failed', error, message: 'Custom failure message' })
    })

    it('keeps the original error object when a custom message is given', () => {
      const error = new Error('Original error message')
      const result = createFailedResult(error, 'Custom failure message')

      expect(result.error).toBe(error)
    })

    it('uses error message when custom message is undefined', () => {
      const error = new Error('Error from exception')
      const result = createFailedResult(error, undefined)

      expect(result).toEqual({ status: 'failed', error, message: 'Error from exception' })
    })

    it('handles errors with empty message', () => {
      const error = new Error('')
      const result = createFailedResult(error)

      expect(result).toEqual({ status: 'failed', error, message: '' })
    })

    it('keeps the original error object when its message is empty', () => {
      const error = new Error('')
      const result = createFailedResult(error)

      expect(result.error).toBe(error)
    })
  })
})
