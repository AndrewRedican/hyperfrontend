import type { MockFn } from '@hyperfrontend/testing'
import type { Timer } from './create-timer'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTimer } from './create-timer'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  clearTimeout: (id: NodeJS.Timeout) => clearTimeout(id),
}))
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/date', () => ({
  dateNow: () => Date.now(),
}))

describe('createTimer', () => {
  let callback: MockFn<[], void>
  let timer: Timer

  beforeEach(() => {
    jest.useFakeTimers({ now: 0 })
    callback = jest.fn()
    timer = createTimer(callback, 200)
  })

  afterEach(() => jest.useRealTimers())

  it('correctly calls the callback after the specified delay', () => {
    timer.resume()
    jest.advanceTimersByTime(100)
    const callsBeforeDelay = callback.mock.calls.length
    jest.advanceTimersByTime(150)
    expect({ callsBeforeDelay, callsAfterDelay: callback.mock.calls.length }).toEqual({ callsBeforeDelay: 0, callsAfterDelay: 1 })
  })

  it('pauses and does not call the callback if not resumed in time', () => {
    timer.resume()
    jest.advanceTimersByTime(100)
    timer.pause()
    jest.advanceTimersByTime(150)
    expect(callback).not.toHaveBeenCalled()
  })

  it('resets and calls the callback after the new delay', () => {
    timer.resume()
    jest.advanceTimersByTime(100)
    timer.reset(300)
    jest.advanceTimersByTime(250)
    const callsBeforeNewDelay = callback.mock.calls.length
    jest.advanceTimersByTime(100)
    expect({ callsBeforeNewDelay, callsAfterNewDelay: callback.mock.calls.length }).toEqual({
      callsBeforeNewDelay: 0,
      callsAfterNewDelay: 1,
    })
  })

  it('resets and calls the callback after the same delay', () => {
    timer.resume()
    jest.advanceTimersByTime(100)
    timer.reset()
    jest.advanceTimersByTime(100)
    const callsBeforeDelay = callback.mock.calls.length
    jest.advanceTimersByTime(150)
    expect({ callsBeforeDelay, callsAfterDelay: callback.mock.calls.length }).toEqual({ callsBeforeDelay: 0, callsAfterDelay: 1 })
  })

  it('does nothing when pause is called while already paused', () => {
    timer.pause()
    timer.pause()
    expect(callback).not.toHaveBeenCalled()
  })

  it('does nothing when resume is called while already running', () => {
    timer.resume()
    timer.resume()
    jest.advanceTimersByTime(250)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('correctly tracks remaining time when paused and resumed', () => {
    timer.resume()
    jest.advanceTimersByTime(100)
    timer.pause()
    jest.advanceTimersByTime(200)
    timer.resume()
    jest.advanceTimersByTime(99)
    const callsBeforeRemaining = callback.mock.calls.length
    jest.advanceTimersByTime(1)
    expect({ callsBeforeRemaining, callsAfterRemaining: callback.mock.calls.length }).toEqual({
      callsBeforeRemaining: 0,
      callsAfterRemaining: 1,
    })
  })

  it('can pause immediately after resume before any time elapses', () => {
    timer.resume()
    timer.pause()
    expect(callback).not.toHaveBeenCalled()
  })
})
