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

  it('raises a negative delay to the minimum a real timer uses', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    setTimeout(ran, -500)
    runAllTimers()
    assert.equal(ran.mock.calls.length, 1)
  })

  it('raises a negative interval period to the minimum, so a tick cannot loop forever', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    const handle = setInterval(ran, -10)
    advanceTimersByTime(3)
    clearInterval(handle)
    assert.equal(ran.mock.calls.length, 3)
  })

  it('raises an omitted delay to the minimum', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    setTimeout(ran)
    advanceTimersByTime(1)
    assert.equal(ran.mock.calls.length, 1)
  })

  it('runs a timer that another timer scheduled', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    setTimeout(() => setTimeout(() => setTimeout(ran, 30), 20), 10)
    runAllTimers()
    assert.equal(ran.mock.calls.length, 1)
  })

  it('runs a timer that an interval scheduled', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    const handle = setInterval(() => {
      clearInterval(handle)
      setTimeout(ran, 100)
    }, 10)
    runAllTimers()
    assert.equal(ran.mock.calls.length, 1)
  })

  it('finishes even though an uncleared interval is always pending', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    const handle = setInterval(ran, 10)
    runAllTimers()
    clearInterval(handle)
    assert.equal(ran.mock.calls.length > 0, true)
  })

  it('gives up on a cascade that never stops rather than hanging', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    /**
     * Schedules itself again every time it runs, so the queue is never empty.
     */
    function reschedule(): void {
      ran()
      setTimeout(reschedule, 10)
    }
    setTimeout(reschedule, 10)
    runAllTimers()
    assert.equal(ran.mock.calls.length > 1, true)
  })

  it('forgets a timeout that was cleared before it ran', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    clearTimeout(setTimeout(ran, 10))
    runAllTimers()
    assert.equal(ran.mock.calls.length, 0)
  })

  it('passes a timer its extra arguments', () => {
    useFakeTimers({ now: 0 })
    const ran = createMockFn()
    setTimeout(ran, 10, 'first', 'second')
    runAllTimers()
    assert.deepEqual(ran.mock.calls[0], ['first', 'second'])
  })

  it('leaves the schedulers alone when they were excluded from faking', () => {
    useFakeTimers({ doNotFake: ['setTimeout', 'setInterval'] })
    assert.equal(typeof setTimeout, 'function')
  })
})
