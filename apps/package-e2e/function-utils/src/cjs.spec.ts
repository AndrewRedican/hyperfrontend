/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/function-utils`
 * Tests that the package is requireable and exports work correctly.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')

describe('@hyperfrontend/function-utils CJS', () => {
  it('is requireable', () => {
    const functionUtils = require('@hyperfrontend/function-utils')
    expect(functionUtils).toBeDefined()
  })

  it('exports createRunOnceFunction', () => {
    const { createRunOnceFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createRunOnceFunction).toBe('function')
  })

  it('creates a run-once function that returns the result on every call', () => {
    const { createRunOnceFunction } = require('@hyperfrontend/function-utils')

    const fn = createRunOnceFunction(() => 'result')

    const firstCall = fn()
    const secondCall = fn()

    expect({ firstCall, secondCall }).toEqual({ firstCall: 'result', secondCall: 'result' })
  })

  it('creates a run-once function that executes only once', () => {
    const { createRunOnceFunction } = require('@hyperfrontend/function-utils')

    let callCount = 0
    const fn = createRunOnceFunction(() => {
      callCount++
      return 'result'
    })

    fn()
    fn()

    expect(callCount).toBe(1)
  })

  it('exports noop', () => {
    const { noop } = require('@hyperfrontend/function-utils')
    expect(typeof noop).toBe('function')
  })

  it('returns undefined from noop', () => {
    const { noop } = require('@hyperfrontend/function-utils')
    expect(noop()).toBeUndefined()
  })

  it('exports createErrorIgnoringFunction', () => {
    const { createErrorIgnoringFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createErrorIgnoringFunction).toBe('function')
  })

  it('creates an error-ignoring function that swallows the error its target throws', () => {
    const { createErrorIgnoringFunction } = require('@hyperfrontend/function-utils')

    const safeFn = createErrorIgnoringFunction(() => {
      throw new Error('test error')
    })
    expect(() => safeFn()).not.toThrow()
  })

  it('exports createConditionalExecutionFunction', () => {
    const { createConditionalExecutionFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createConditionalExecutionFunction).toBe('function')
  })

  it('creates a conditional function that executes its target when the condition holds', () => {
    const { createConditionalExecutionFunction } = require('@hyperfrontend/function-utils')

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
