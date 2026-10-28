import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { setIntervalCallback } from './set-interval-callback'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: (callback: () => void, delay: number) => setInterval(callback, delay),
  clearInterval: (id: NodeJS.Timeout) => clearInterval(id),
}))

describe('setIntervalCallback', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('repeatedly calls the callback at specified intervals', () => {
    const callback = jest.fn()
    const stopInterval = setIntervalCallback(callback, 100)
    jest.advanceTimersByTime(350)
    stopInterval()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('stops calling the callback once the returned stop function runs', () => {
    const callback = jest.fn()
    const stopInterval = setIntervalCallback(callback, 100)
    jest.advanceTimersByTime(350)
    stopInterval()
    jest.advanceTimersByTime(200)
    expect(callback).toHaveBeenCalledTimes(3)
  })
})
