import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { watchPageVisibility } from './page-visibility'

// why: The watch reads its timers from the built-in copy, which is captured before fake timers are installed; the copy is redirected at the globals the fake clock replaces so a test can drive both the poll and the probe frame.
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: (callback: () => void, delay: number) => setInterval(callback, delay),
  clearInterval: (id: number) => clearInterval(id),
  requestAnimationFrame: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
  cancelAnimationFrame: (handle: number) => cancelAnimationFrame(handle),
}))

/** How long the watch's own poll waits between readings. */
const POLL_INTERVAL_MS = 2000

/** Long enough for the browser to serve one animation frame. */
const ONE_FRAME_MS = 20

/** Every teardown a test built, so no poll or probe frame outlives it. */
const teardowns: (() => void)[] = []

/**
 * Pins what the page reports about itself, saying nothing about the change.
 *
 * @param value - The state `document.visibilityState` should report.
 */
function setVisibilityState(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
}

/**
 * Pins what the page reports and announces it, as a delivered event does.
 *
 * @param value - The state `document.visibilityState` should report.
 */
function announceVisibilityState(value: 'visible' | 'hidden'): void {
  setVisibilityState(value)
  document.dispatchEvent(new Event('visibilitychange'))
}

/**
 * Starts a watch whose reports the test can read back.
 *
 * @returns The reported states, in order.
 */
function watch(): boolean[] {
  const reported: boolean[] = []
  teardowns.push(watchPageVisibility((hidden) => reported.push(hidden)))
  return reported
}

describe('watchPageVisibility', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    for (const stop of teardowns.splice(0)) {
      stop()
    }
    jest.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('reports the current state immediately', () => {
    expect(watch()).toEqual([false])
  })

  it('reports hidden immediately when the page starts hidden', () => {
    setVisibilityState('hidden')
    expect(watch()).toEqual([true])
  })

  it('reports an announced change', () => {
    const reported = watch()
    announceVisibilityState('hidden')
    expect(reported).toEqual([false, true])
  })

  it('never repeats a state it has already reported', () => {
    const reported = watch()
    announceVisibilityState('hidden')
    announceVisibilityState('hidden')
    expect(reported).toEqual([false, true])
  })

  it('reports a return to the page on the first frame it is painted, with nothing announced', () => {
    const reported = watch()
    announceVisibilityState('hidden')
    setVisibilityState('visible')
    jest.advanceTimersByTime(ONE_FRAME_MS)
    expect(reported).toEqual([false, true, false])
  })

  it('reports a return the poll finds when no frame was served', () => {
    const reported = watch()
    announceVisibilityState('hidden')
    setVisibilityState('visible')
    jest.advanceTimersByTime(POLL_INTERVAL_MS)
    expect(reported).toEqual([false, true, false])
  })

  it('reports a hide the page never announced', () => {
    const reported = watch()
    setVisibilityState('hidden')
    jest.advanceTimersByTime(POLL_INTERVAL_MS)
    expect(reported).toEqual([false, true])
  })

  it('keeps reporting hidden while the page still calls itself hidden', () => {
    const reported = watch()
    announceVisibilityState('hidden')
    jest.advanceTimersByTime(POLL_INTERVAL_MS * 2)
    expect(reported).toEqual([false, true])
  })

  it('stops reporting after teardown', () => {
    const reported = watch()
    for (const stop of teardowns.splice(0)) {
      stop()
    }
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    jest.advanceTimersByTime(POLL_INTERVAL_MS * 2)
    expect(reported).toEqual([false])
  })

  it('leaves no probe frame behind when a watch on a hidden page is torn down', () => {
    setVisibilityState('hidden')
    const reported = watch()
    for (const stop of teardowns.splice(0)) {
      stop()
    }
    setVisibilityState('visible')
    jest.advanceTimersByTime(ONE_FRAME_MS)
    expect(reported).toEqual([true])
  })
})
