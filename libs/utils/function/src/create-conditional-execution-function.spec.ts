import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createConditionalExecutionFunction } from './create-conditional-execution-function'

describe('createConditionalExecutionFunction', () => {
  it('returns the result of the function when the condition is true', () => {
    const testFunc = jest.fn((x: number) => x * 3)
    const condition = jest.fn(() => true)

    const conditionalFunc = createConditionalExecutionFunction(testFunc, condition)

    expect(conditionalFunc(3)).toBe(9)
  })

  it('executes the function with the given arguments when the condition is true', () => {
    const testFunc = jest.fn((x: number) => x * 3)
    const condition = jest.fn(() => true)

    const conditionalFunc = createConditionalExecutionFunction(testFunc, condition)

    conditionalFunc(3)
    expect(testFunc).toHaveBeenCalledWith(3)
  })

  it('consults the condition when it is true', () => {
    const testFunc = jest.fn((x: number) => x * 3)
    const condition = jest.fn(() => true)

    const conditionalFunc = createConditionalExecutionFunction(testFunc, condition)

    conditionalFunc(3)
    expect(condition).toHaveBeenCalled()
  })

  it('calls the wrapped function with the receiver it was invoked on', () => {
    const host = {
      value: 'host',
      read: createConditionalExecutionFunction(
        function (this: { value: string }) {
          return this.value
        },
        () => true
      ),
    }
    expect(host.read()).toBe('host')
  })

  it('returns undefined when the condition is false', () => {
    const testFunc = jest.fn((x: number) => x * 3)
    const condition = jest.fn(() => false)

    const conditionalFunc = createConditionalExecutionFunction(testFunc, condition)

    expect(conditionalFunc(3)).toBeUndefined()
  })

  it('does not execute the function when the condition is false', () => {
    const testFunc = jest.fn((x: number) => x * 3)
    const condition = jest.fn(() => false)

    const conditionalFunc = createConditionalExecutionFunction(testFunc, condition)

    conditionalFunc(3)
    expect(testFunc).not.toHaveBeenCalled()
  })

  it('consults the condition when it is false', () => {
    const testFunc = jest.fn((x: number) => x * 3)
    const condition = jest.fn(() => false)

    const conditionalFunc = createConditionalExecutionFunction(testFunc, condition)

    conditionalFunc(3)
    expect(condition).toHaveBeenCalled()
  })
})
