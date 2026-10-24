import { advanceTimersByTime, isFakeClock } from '../mock/timers'
import { realTimers, sleep } from './real-timers'

/**
 * How long `waitFor` and `waitUntil` keep trying, and how often.
 */
export type WaitOptions = {
  /** Milliseconds of real time before giving up. Defaults to 1000. */
  timeout?: number
  /** Milliseconds between attempts. Defaults to 50. */
  interval?: number
}

/**
 * An attempt that succeeded.
 */
type Success<TValue> = {
  /** Marks the attempt as one that ended the wait. */
  done: true
  /** What the attempt produced. */
  value: TValue
}

/**
 * An attempt that has to be repeated.
 */
type Failure = {
  /** Marks the attempt as one that did not end the wait. */
  done: false
  /** What the attempt threw, if it threw. */
  error?: unknown
}

/**
 * What one attempt produced.
 */
type Attempt<TValue> = Success<TValue> | Failure

/**
 * Marks an attempt that was still running when the time ran out.
 */
const EXPIRED = Symbol('expired')

/**
 * Settles with the attempt, or with `EXPIRED` once the deadline passes, whichever comes
 * first. The deadline timer is cleared either way, so a finished wait never holds the
 * process open.
 *
 * @param attempt - The running attempt.
 * @param milliseconds - Real time left before the deadline.
 * @returns The attempt's outcome, or `EXPIRED`.
 */
async function beforeDeadline<TValue>(attempt: Promise<Attempt<TValue>>, milliseconds: number): Promise<Attempt<TValue> | typeof EXPIRED> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<typeof EXPIRED>((resolve) => {
    timer = realTimers.setTimeout(() => resolve(EXPIRED), milliseconds)
  })
  try {
    return await Promise.race([attempt, deadline])
  } finally {
    realTimers.clearTimeout(timer)
  }
}

/**
 * Repeats an attempt until it succeeds or the timeout passes on the real clock.
 *
 * Between attempts it waits one interval of real time and, when the fake clock is installed,
 * advances that clock by the same interval, so code scheduled on fake timers makes progress
 * while the wait polls.
 *
 * @param run - One attempt.
 * @param options - Timeout and interval.
 * @param describe - Builds the error thrown when time runs out, from the last failure.
 * @returns The value of the attempt that succeeded.
 */
async function poll<TValue>(
  run: () => Promise<Attempt<TValue>>,
  options: WaitOptions,
  describe: (last: unknown, timeout: number) => unknown
): Promise<TValue> {
  const timeout = options.timeout ?? 1000
  const interval = options.interval ?? 50
  const started = performance.now()
  let last: unknown

  for (;;) {
    const outcome = await beforeDeadline(run(), Math.max(0, timeout - (performance.now() - started)))
    if (outcome === EXPIRED) throw describe(last, timeout)
    if (outcome.done === true) return outcome.value
    last = outcome.error
    if (performance.now() - started >= timeout) throw describe(last, timeout)
    if (isFakeClock()) advanceTimersByTime(interval)
    await sleep(interval)
  }
}

/**
 * Calls a callback until it returns without throwing, and resolves with what it returned.
 *
 * Put the assertion inside the callback: the wait passes as soon as it holds, and when time
 * runs out the last error is thrown as it is, so the failure reads as the assertion's own.
 * A callback returning a promise is awaited, and a rejection counts as a throw.
 *
 * @param callback - The check to repeat.
 * @param options - Timeout and interval.
 * @returns What the callback returned on the attempt that passed.
 * @throws {unknown} The callback's last error when the timeout passes, or a timeout error when it never finished an attempt.
 * @example Waiting for a reply to arrive
 * ```ts
 * channel.send('PING')
 * await waitFor(() => expect(received).toEqual(['PONG']))
 * ```
 */
export function waitFor<TValue>(callback: () => TValue | Promise<TValue>, options: WaitOptions = {}): Promise<Awaited<TValue>> {
  return poll<Awaited<TValue>>(
    async () => {
      try {
        return { done: true, value: await callback() }
      } catch (error) {
        return { done: false, error }
      }
    },
    options,
    (last, timeout) => last ?? new Error(`waitFor timed out after ${timeout}ms before the callback finished an attempt`)
  )
}

/**
 * Calls a predicate until it returns a truthy value, and resolves with that value.
 *
 * A throw is a failure, not a falsy result: it is raised straight away rather than retried,
 * so a broken predicate fails fast. A predicate returning a promise is awaited.
 *
 * @param predicate - The condition to repeat.
 * @param options - Timeout and interval.
 * @returns The first truthy value the predicate returned.
 * @throws {Error} When the timeout passes before the predicate returns a truthy value.
 * @example Waiting until both sides are connected
 * ```ts
 * await waitUntil(() => channelA.isActive() && channelB.isActive())
 * ```
 * @example Waiting for an element and using it
 * ```ts
 * const button = await waitUntil(() => document.querySelector('button'))
 * button.click()
 * ```
 */
export function waitUntil<TValue>(
  predicate: () => TValue | Promise<TValue>,
  options: WaitOptions = {}
): Promise<NonNullable<Awaited<TValue>>> {
  return poll<NonNullable<Awaited<TValue>>>(
    async () => {
      const value = await predicate()
      return value ? { done: true, value: value as NonNullable<Awaited<TValue>> } : { done: false }
    },
    options,
    (_last, timeout) => new Error(`waitUntil timed out after ${timeout}ms: the predicate never returned a truthy value`)
  )
}
