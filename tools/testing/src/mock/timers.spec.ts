import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { createMockFn } from './mock-fn'
import { advanceTimersByTime, clearAllTimers, runAllTimers, setSystemTime, useFakeTimers, useRealTimers } from './timers'

describe('fake timers', () => {
  afterEach(() => {
    useRealTimers()
  })

  it('holds a scheduled callback until the clock advances', () => {
    useFakeTimers()
    const ran = createMockFn()
    setTimeout(ran, 100)
    assert.equal(ran.mock.calls.length, 0)
  })

  it('runs a scheduled callback once the clock passes its delay', () => {
    useFakeTimers()
    const ran = createMockFn()
    setTimeout(ran, 100)
    advanceTimersByTime(100)
    assert.equal(ran.mock.calls.length, 1)
  })

  it('leaves a callback pending when the clock stops short', () => {
    useFakeTimers()
    const ran = createMockFn()
    setTimeout(ran, 100)
    advanceTimersByTime(99)
    assert.equal(ran.mock.calls.length, 0)
  })

  it('repeats an interval once per elapsed period', () => {
    useFakeTimers()
    const ran = createMockFn()
    const handle = setInterval(ran, 10)
    advanceTimersByTime(30)
    clearInterval(handle)
    assert.equal(ran.mock.calls.length, 3)
  })

  it('runs every pending timer on demand', () => {
    useFakeTimers()
    const ran = createMockFn()
    setTimeout(ran, 10_000)
    runAllTimers()
    assert.equal(ran.mock.calls.length, 1)
  })

  it('starts the clock at the requested instant', () => {
    useFakeTimers({ now: 5_000 })
    assert.equal(Date.now(), 5_000)
  })

  it('moves the clock to a requested instant', () => {
    useFakeTimers({ now: 0 })
    setSystemTime(1_234)
    assert.equal(Date.now(), 1_234)
  })

  it('accepts a Date as the starting instant', () => {
    useFakeTimers({ now: new Date(7_000) })
    assert.equal(Date.now(), 7_000)
  })

  it('leaves an excluded API real', () => {
    useFakeTimers({ doNotFake: ['Date'] })
    assert.equal(Date.now() > 1_600_000_000_000, true)
  })

  it('discards pending timers without uninstalling the clock', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    setTimeout(ran, 10)
    clearAllTimers()
    advanceTimersByTime(100)
    assert.equal(ran.mock.calls.length, 0)
  })

  it('carries the current instant across a clear', () => {
    useFakeTimers({ now: 0 })
    advanceTimersByTime(500)
    clearAllTimers()
    assert.equal(Date.now(), 500)
  })

  it('ignores a clear when no clock is installed', () => {
    assert.doesNotThrow(() => clearAllTimers())
  })

  it('ignores a restore when no clock is installed', () => {
    assert.doesNotThrow(() => useRealTimers())
  })
})
