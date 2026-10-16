/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/function-utils`
 * Tests that the package is importable and exports work correctly.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

describe('@hyperfrontend/function-utils ESM', () => {
  it('is importable', async () => {
    const functionUtils = await import('@hyperfrontend/function-utils')
    expect(functionUtils).toBeDefined()
  })

  it('exports createRunOnceFunction', async () => {
    const { createRunOnceFunction } = await import('@hyperfrontend/function-utils')
    expect(typeof createRunOnceFunction).toBe('function')
  })

  it('creates a run-once function that returns the result on every call', async () => {
    const { createRunOnceFunction } = await import('@hyperfrontend/function-utils')

    const fn = createRunOnceFunction(() => 'result')

    const firstCall = fn()
    const secondCall = fn()

    expect({ firstCall, secondCall }).toEqual({ firstCall: 'result', secondCall: 'result' })
  })

  it('creates a run-once function that executes only once', async () => {
    const { createRunOnceFunction } = await import('@hyperfrontend/function-utils')

    let callCount = 0
    const fn = createRunOnceFunction(() => {
      callCount++
      return 'result'
    })

    fn()
    fn()

    expect(callCount).toBe(1)
  })

  it('exports noop', async () => {
    const { noop } = await import('@hyperfrontend/function-utils')
    expect(typeof noop).toBe('function')
  })

  it('returns undefined from noop', async () => {
    const { noop } = await import('@hyperfrontend/function-utils')
    expect(noop()).toBeUndefined()
  })

  it('exports createErrorIgnoringFunction', async () => {
    const { createErrorIgnoringFunction } = await import('@hyperfrontend/function-utils')
    expect(typeof createErrorIgnoringFunction).toBe('function')
  })

  it('creates an error-ignoring function that swallows the error its target throws', async () => {
    const { createErrorIgnoringFunction } = await import('@hyperfrontend/function-utils')

    const safeFn = createErrorIgnoringFunction(() => {
      throw new Error('test error')
    })
    expect(() => safeFn()).not.toThrow()
  })

  it('exports createConditionalExecutionFunction', async () => {
    const { createConditionalExecutionFunction } = await import('@hyperfrontend/function-utils')
    expect(typeof createConditionalExecutionFunction).toBe('function')
  })

  it('creates a conditional function that executes its target when the condition holds', async () => {
    const { createConditionalExecutionFunction } = await import('@hyperfrontend/function-utils')

    let executed = false
    const conditionalFn = createConditionalExecutionFunction(
      () => {
        executed = true
      },
      () => true
    )
    conditionalFn()
    expect(executed).toBe(true)
  })
})
