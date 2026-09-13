import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createRunOnceFunction } from './create-run-once-function'

describe('createRunOnceFunction', () => {
  it('executes the function only once', () => {
    const mockFn = jest.fn()
    const runOnceFn = createRunOnceFunction(mockFn)
    runOnceFn()
    runOnceFn()
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('calls the wrapped function with the receiver it was invoked on', () => {
    const host = {
      value: 'host',
      read: createRunOnceFunction(function (this: { value: string }) {
        return this.value
      }),
    }
    expect(host.read()).toBe('host')
  })

  it('does not override an explicitly bound receiver', () => {
    const bound = { value: 'bound' }
    const other = { value: 'other' }
    const read = createRunOnceFunction(
      function (this: { value: string }) {
        return this.value
      }.bind(bound)
    )
    expect(read.call(other)).toBe('bound')
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
