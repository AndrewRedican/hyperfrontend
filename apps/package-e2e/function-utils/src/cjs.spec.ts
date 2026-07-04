/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/function-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/function-utils CJS', () => {
  it('should be requireable', () => {
    const functionUtils = require('@hyperfrontend/function-utils')
    expect(functionUtils).toBeDefined()
  })

  it('should export createRunOnceFunction', () => {
    const { createRunOnceFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createRunOnceFunction).toBe('function')
  })

  it('should create a run-once function that executes only once', () => {
    const { createRunOnceFunction } = require('@hyperfrontend/function-utils')

    let callCount = 0
    const fn = createRunOnceFunction(() => {
      callCount++
      return 'result'
    })

    expect(fn()).toBe('result')
    expect(fn()).toBe('result')
    expect(callCount).toBe(1)
  })

  it('should export noop', () => {
    const { noop } = require('@hyperfrontend/function-utils')
    expect(typeof noop).toBe('function')
    expect(noop()).toBeUndefined()
  })

  it('should export createErrorIgnoringFunction', () => {
    const { createErrorIgnoringFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createErrorIgnoringFunction).toBe('function')

    const safeFn = createErrorIgnoringFunction(() => {
      throw new Error('test error')
    })
    expect(() => safeFn()).not.toThrow()
  })

  it('should export createConditionalExecutionFunction', () => {
    const { createConditionalExecutionFunction } = require('@hyperfrontend/function-utils')
    expect(typeof createConditionalExecutionFunction).toBe('function')

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
