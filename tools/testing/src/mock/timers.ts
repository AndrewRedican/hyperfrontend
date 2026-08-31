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
 * Installs a fake clock over the timer APIs.
 *
 * @param options - Which APIs to leave real, and where the clock starts.
 */
export function useFakeTimers(options: FakeTimerOptions = {}): void {
  const apis = options.doNotFake ? FAKEABLE.filter((api) => !options.doNotFake?.includes(api)) : FAKEABLE
  const now = options.now instanceof Date ? options.now.getTime() : options.now
  mock.timers.enable({ apis, ...(now === undefined ? {} : { now }) })
  clock.faked = true
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
 * Runs every pending timer immediately.
 */
export function runAllTimers(): void {
  mock.timers.runAll()
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
  mock.timers.enable({ apis: FAKEABLE, now: instant })
}

/**
 * Moves the fake clock to a specific instant without running timers.
 *
 * @param instant - The instant to set, as a timestamp or Date.
 */
export function setSystemTime(instant: number | Date): void {
  mock.timers.setTime(instant instanceof Date ? instant.getTime() : instant)
}
