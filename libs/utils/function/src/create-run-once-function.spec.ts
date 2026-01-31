import { createRunOnceFunction } from './create-run-once-function'

describe('createRunOnceFunction', () => {
  it('executes the function only once', () => {
    const mockFn = jest.fn()
    const runOnceFn = createRunOnceFunction(mockFn)
    runOnceFn()
    runOnceFn()
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('returns the correct value on first call', () => {
    const returnVal = 'test value'
    const func = () => returnVal
    const runOnceFn = createRunOnceFunction(func)

    expect(runOnceFn()).toBe(returnVal)
  })

  it('returns the same value on subsequent calls', () => {
    const returnVal = 'test value'
    const func = () => returnVal
    const runOnceFn = createRunOnceFunction(func)
    const firstCallResult = runOnceFn()
    const secondCallResult = runOnceFn()
    expect(firstCallResult).toBe(secondCallResult)
    expect(secondCallResult).toBe(returnVal)
  })
})
