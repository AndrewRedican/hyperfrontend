import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { setTimeout, clearTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** Timer interface with pause, resume, and reset capabilities. */
export interface Timer {
  /** Stops the progression of tracked time until further notice. */
  readonly pause: () => void
  /** Reinstates the progression of tracked time. */
  readonly resume: () => void
  /** Assigns a new wait time before function is invoked. */
  readonly reset: (newDelay?: number) => void
}

/**
 * Invokes callback function after the designated time has passed, much like a timer.
 * Allows you to pause, resume, or reset the progress of time tracked.
 *
 * @param callback - The function to invoke after the delay
 * @param delay - Time in milliseconds to wait until callback is invoked
 * @returns A Timer instance with pause, resume, and reset methods
 *
 * @example
 * ```typescript
 * const timer = createTimer(() => {
 *   console.log('Session expired')
 * }, 30_000)
 *
 * timer.resume() // Start the 30-second countdown
 *
 * // User activity detected - pause the timer
 * timer.pause()
 *
 * // User idle again - resume from where we left off
 * timer.resume()
 *
 * // Reset to full 30 seconds on explicit action
 * timer.reset()
 * ```
 */
export function createTimer(callback: () => void, delay: number): Timer {
  let timerId: NodeJS.Timeout | null = null
  let start: number | null = null
  let remaining: number = delay

  const pause = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId)
      const now = dateNow()
      /* istanbul ignore else - start is always set when timerId is not null */
      if (start !== null) {
        remaining -= now - start
      }
      timerId = null
    }
  }

  const resume = (): void => {
    if (timerId === null) {
      start = dateNow()
      timerId = setTimeout(() => {
        callback()
        timerId = null
      }, remaining)
    }
  }

  const reset = (newDelay: number = delay): void => {
    pause()
    remaining = newDelay
    resume()
  }

  return freeze({ pause, resume, reset })
}
