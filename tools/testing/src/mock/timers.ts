import { mock } from 'node:test'

/**
 * Options accepted by `jest.useFakeTimers`, narrowed to what the workspace's suites pass.
 */
export type FakeTimerOptions = {
  /** Timer APIs to leave real. */
  doNotFake?: FakeableApi[]
  /** The clock's starting instant. */
  now?: number | Date
}

/**
 * A timer API Node is able to fake.
 */
export type FakeableApi = 'setTimeout' | 'setInterval' | 'setImmediate' | 'Date'

/**
 * The timer APIs faked by default. Jest fakes everything it can; Node makes the caller
 * name each one, so the default list is spelled out here to match.
 */
const FAKEABLE: FakeableApi[] = ['setTimeout', 'setInterval', 'setImmediate', 'Date']

/**
 * Whether a fake clock is currently installed, so real-timer restoration is a no-op when
 * no clock was ever faked.
 */
const clock = { faked: false }

/**
 * Handles of timeouts scheduled against the fake clock that have neither run nor been
 * cleared. Intervals are deliberately absent: one that is never cleared is always pending,
 * so counting them would make a drain that has finished look unfinished.
 */
const pendingTimeouts = new Set<unknown>()

/**
 * How many times `runAllTimers` will re-run the queue before giving up. A cascade this
 * deep is a runaway rather than a test, and stopping is what keeps it from hanging.
 */
const MAX_DRAIN_PASSES = 1000

/**
 * The handle a scheduler returned, held in a box so the callback can reach it. The callback
 * has to forget the handle when it runs, and it is built before the handle exists.
 */
type ScheduledHandle = {
  /** What the underlying scheduler returned, once it has returned. */
  id?: unknown
}

/**
 * Installs a fake clock over the timer APIs.
 *
 * @param options - Which APIs to leave real, and where the clock starts.
 */
export function useFakeTimers(options: FakeTimerOptions = {}): void {
  const apis = options.doNotFake ? FAKEABLE.filter((api) => !options.doNotFake?.includes(api)) : FAKEABLE
  const now = options.now instanceof Date ? options.now.getTime() : options.now
  enableClock(apis, now)
  clock.faked = true
}

/**
 * Installs the fake clock, then wraps the schedulers it put on the global.
 *
 * Two things are corrected here. A real scheduler raises any delay below one millisecond
 * to one, as the platform requires, while Node's fake clock keeps the number it was given:
 * a negative delay then asks the clock to run backwards, and a zero-period interval never
 * stops firing within a single tick. The delay is clamped at the point of scheduling, which
 * is where the real timers clamp it, so a spy watching the call still records what its
 * caller passed. Outstanding timeouts are also recorded, because Node offers no way to ask
 * whether any remain and `runAllTimers` has to know when it has finished.
 *
 * @param apis - The timer APIs to fake.
 * @param now - The instant to start the clock at, or undefined to start where it is.
 */
function enableClock(apis: FakeableApi[], now?: number): void {
  mock.timers.enable({ apis, ...(now === undefined ? {} : { now }) })
  pendingTimeouts.clear()

  if (apis.includes('setTimeout')) {
    wrapScheduler('setTimeout', true)
    wrapCanceller('clearTimeout')
  }
  if (apis.includes('setInterval')) wrapScheduler('setInterval', false)
}

/**
 * Replaces a scheduler on the global with one that clamps its delay and, for timeouts,
 * records the handle until the callback runs.
 *
 * @param api - The scheduler to wrap.
 * @param once - Whether the callback runs a single time, making the handle discardable.
 */
function wrapScheduler(api: 'setTimeout' | 'setInterval', once: boolean): void {
  const scheduled = globalThis[api] as (handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => unknown

  Object.defineProperty(globalThis, api, {
    value: (handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      const handle: ScheduledHandle = {}
      const callback = once
        ? (...called: unknown[]) => {
            pendingTimeouts.delete(handle.id)
            handler(...called)
          }
        : handler

      handle.id = scheduled(callback, Math.max(delay ?? 1, 1), ...args)
      if (once) pendingTimeouts.add(handle.id)
      return handle.id
    },
    writable: true,
    configurable: true,
  })
}

/**
 * Replaces a canceller on the global with one that forgets the handle it cancels.
 *
 * @param api - The canceller to wrap.
 */
function wrapCanceller(api: 'clearTimeout'): void {
  const cancelled = globalThis[api] as (id?: unknown) => void

  Object.defineProperty(globalThis, api, {
    value: (id?: unknown) => {
      pendingTimeouts.delete(id)
      cancelled(id)
    },
    writable: true,
    configurable: true,
  })
}

/**
 * Uninstalls the fake clock, restoring the real timer APIs.
 */
export function useRealTimers(): void {
  if (!clock.faked) return
  mock.timers.reset()
  clock.faked = false
}

/**
 * Advances the fake clock, running everything scheduled within the window.
 *
 * @param milliseconds - How far to advance.
 */
export function advanceTimersByTime(milliseconds: number): void {
  mock.timers.tick(milliseconds)
}

/**
 * Runs every pending timer immediately, including the ones those timers schedule.
 *
 * Node's `runAll` drains only the queue as it stood when it was called, so a callback that
 * schedules further work leaves that work pending. Jest keeps going until the queue is
 * empty, and suites written against it rely on a single call carrying a whole cascade
 * through. The queue is re-run until no timeout is outstanding.
 */
export function runAllTimers(): void {
  for (let pass = 0; pass < MAX_DRAIN_PASSES; pass += 1) {
    mock.timers.runAll()
    if (pendingTimeouts.size === 0) return
  }
}

/**
 * Discards pending timers while keeping the fake clock installed.
 *
 * Node has no primitive for this, so the clock is torn down and rebuilt. The instant is
 * carried across, because tests that clear timers still expect `Date.now` to be where the
 * previous ticks left it.
 */
export function clearAllTimers(): void {
  if (!clock.faked) return
  const instant = Date.now()
  mock.timers.reset()
  enableClock(FAKEABLE, instant)
}

/**
 * Moves the fake clock to a specific instant without running timers.
 *
 * @param instant - The instant to set, as a timestamp or Date.
 */
export function setSystemTime(instant: number | Date): void {
  mock.timers.setTime(instant instanceof Date ? instant.getTime() : instant)
}
