/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/function-utils`
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/function-utils ESM', () => {
  it('is importable', async () => {
    const functionUtils = await import('@hyperfrontend/function-utils')
    expect(functionUtils).toBeDefined()
  })

  it('exports createRunOnceFunction', async () => {
    const { createRunOnceFunction } = await import('@hyperfrontend/function-utils')
    expect(typeof createRunOnceFunction).toBe('function')
  })

  it('creates a run-once function that executes only once', async () => {
    const { createRunOnceFunction } = await import('@hyperfrontend/function-utils')

    let callCount = 0
    const fn = createRunOnceFunction(() => {
      callCount++
      return 'result'
    })

    expect(fn()).toBe('result')
    expect(fn()).toBe('result')
    expect(callCount).toBe(1)
  })

  it('exports noop', async () => {
    const { noop } = await import('@hyperfrontend/function-utils')
    expect(typeof noop).toBe('function')
    expect(noop()).toBeUndefined()
  })

  it('exports createErrorIgnoringFunction', async () => {
    const { createErrorIgnoringFunction } = await import('@hyperfrontend/function-utils')
    expect(typeof createErrorIgnoringFunction).toBe('function')

    const safeFn = createErrorIgnoringFunction(() => {
      throw new Error('test error')
    })
    expect(() => safeFn()).not.toThrow()
  })

  it('exports createConditionalExecutionFunction', async () => {
    const { createConditionalExecutionFunction } = await import('@hyperfrontend/function-utils')
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
