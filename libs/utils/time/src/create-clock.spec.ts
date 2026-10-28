import type { MockFn } from '@hyperfrontend/testing'
import type { Clock } from './create-clock'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createClock } from './create-clock'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: (callback: () => void, delay: number) => setInterval(callback, delay),
  clearInterval: (id: NodeJS.Timeout) => clearInterval(id),
}))

describe('createClock', () => {
  let callback: MockFn<[currentTime: Date], void>
  let clock: Clock

  beforeEach(() => {
    jest.useFakeTimers()
    callback = jest.fn()
    clock = createClock(100)
  })

  afterEach(() => jest.useRealTimers())

  it('notifies subscribers with the current time', () => {
    clock.subscribe(callback)

    clock.start()
    jest.advanceTimersByTime(350)
    clock.stop()

    expect(callback.mock.calls).toEqual([[expect.any(Date)], [expect.any(Date)], [expect.any(Date)]])
  })

  it('stops notifying subscribers after being stopped', () => {
    clock.start()
    clock.subscribe(callback)

    jest.advanceTimersByTime(350)
    clock.stop()
    jest.advanceTimersByTime(200)

    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('stops invoking callback after unsubscribing', () => {
    clock = createClock()
    clock.subscribe(callback)
    clock.start()

    jest.advanceTimersByTime(clock.interval + 100)
    clock.unsubscribe(callback)

    jest.advanceTimersByTime(clock.interval + 100)
    clock.stop()

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not start a new interval when already started', () => {
    clock.subscribe(callback)
    clock.start()
    clock.start()

    jest.advanceTimersByTime(350)
    clock.stop()

    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('does nothing when stop is called while already stopped', () => {
    clock.subscribe(callback)
    clock.stop()

    expect(callback).not.toHaveBeenCalled()
  })

  it('can be stopped and restarted multiple times', () => {
    clock.subscribe(callback)

    clock.start()
    jest.advanceTimersByTime(150)
    clock.stop()

    clock.start()
    jest.advanceTimersByTime(150)
    clock.stop()

    expect(callback).toHaveBeenCalledTimes(2)
  })
})
