import { setImmediate } from 'node:timers/promises'
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

  it('silently ignores a rejection from an async function', async () => {
    const rejectingFunc = jest.fn(async () => {
      throw new Error('Test error')
    })

    const safeFunc = createErrorIgnoringFunction(rejectingFunc)
    safeFunc()
    // why: an escaped rejection surfaces on the next tick and fails the run, so the wait is the assertion's teeth.
    await setImmediate()
    expect(rejectingFunc).toHaveBeenCalled()
  })

  it('leaves a non-thenable return value alone', () => {
    const testFunc = jest.fn(() => 42)
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
