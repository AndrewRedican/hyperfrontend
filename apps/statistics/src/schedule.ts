import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createTimer } from '@hyperfrontend/time-utils'

/** What a schedule runs, and until when. */
export interface ScheduleOptions {
  /** One turn of the work. It settles its own failures: a rejection ends the schedule and rejects it. */
  task: () => Promise<void>
  /** Time between the end of one turn and the start of the next, in milliseconds */
  everyMs: number
  /** Ends the schedule: no turn starts once it has aborted, and a wait between turns is cut short */
  signal: AbortSignal
}

/**
 * Wait for a number of milliseconds, or less when asked to stop.
 *
 * The wait resolves either way and never rejects, so a caller that stops
 * early reads the signal to learn why it was woken.
 *
 * @param ms - How long to wait
 * @param signal - Cuts the wait short when it aborts
 * @returns A promise that resolves once the time has passed or the signal has aborted
 *
 * @example Waiting a second unless the service is stopped first
 * ```typescript
 * await pause(1000, context.signal)
 * if (context.signal.aborted) return
 * ```
 */
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return createPromise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = createTimer(() => {
      signal.removeEventListener('abort', cut)
      resolve()
    }, ms)
    // why: pausing the timer is what cancels it, so a wait that was cut short leaves nothing behind to keep the process alive
    const cut = (): void => {
      timer.pause()
      resolve()
    }
    signal.addEventListener('abort', cut, { once: true })
    timer.resume()
  })
}

/**
 * Run a task now and again after every interval, until asked to stop.
 *
 * The interval is counted from the end of a turn, so a slow turn never
 * overlaps the next one. The returned promise is the schedule itself: it
 * resolves once the signal has aborted and the turn in flight, if any, has
 * settled, which is what a service awaits before it closes.
 *
 * @param options - See {@link ScheduleOptions}
 * @returns A promise that resolves when the schedule has ended
 *
 * @example Collecting once an hour for the life of a service
 * ```typescript
 * const schedule = runOnSchedule({ task: collectOnce, everyMs: 3_600_000, signal: context.signal })
 * // on close:
 * await schedule
 * ```
 */
export async function runOnSchedule(options: ScheduleOptions): Promise<void> {
  while (!options.signal.aborted) {
    await options.task()
    await pause(options.everyMs, options.signal)
  }
}
