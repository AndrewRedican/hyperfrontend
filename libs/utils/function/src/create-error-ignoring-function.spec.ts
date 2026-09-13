import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createErrorIgnoringFunction } from './create-error-ignoring-function'

describe('createErrorIgnoringFunction', () => {
  it('silently ignores errors thrown by the function', () => {
    const errorFunc = jest.fn(() => {
      throw new Error('Test error')
    })

    const safeFunc = createErrorIgnoringFunction(errorFunc)
    expect(() => safeFunc()).not.toThrow()
    expect(errorFunc).toHaveBeenCalled()
  })

  it('executes the function when there is no error', () => {
    const testFunc = jest.fn(() => void 0)
    const safeFunc = createErrorIgnoringFunction(testFunc)
    safeFunc()
    expect(testFunc).toHaveBeenCalled()
  })

  it('calls the wrapped function with the receiver it was invoked on', () => {
    const seen: string[] = []
    const host = {
      value: 'host',
      record: createErrorIgnoringFunction(function (this: { value: string }) {
        seen.push(this.value)
      }),
    }
    host.record()
    expect(seen).toEqual(['host'])
  })
})
