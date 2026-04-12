import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { setInterval, clearInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Clock interface for interval-based time updates.
 */
export interface Clock {
  /** Start the clock interval */
  readonly start: () => void
  /** Stop the clock interval */
  readonly stop: () => void
  /** Subscribe to time updates */
  readonly subscribe: (callback: (currentTime: Date) => void) => void
  /** Unsubscribe from time updates */
  readonly unsubscribe: (callback: (currentTime: Date) => void) => void
  /** Interval in milliseconds */
  readonly interval: number
}

/**
 * Creates an interval loop that invokes one or more subscribed callback functions
 * at the specified internal (in milliseconds).
 *
 * Allows you to start or stop the interval loop, much like a stop watch.
 * Allows you to unsubscribe callback functions.
 *
 * @param interval - Time in milliseconds between each callback invocation (default: 1000ms)
 * @returns A Clock instance with start, stop, subscribe, and unsubscribe methods
 *
 * @example Creating interval clock
 * ```typescript
 * const clock = createClock(1000)
 *
 * const updateDisplay = (currentTime: Date) => {
 *   console.log(currentTime.toISOString())
 * }
 *
 * clock.subscribe(updateDisplay)
 * clock.start()
 *
 * // Later: stop receiving updates
 * clock.stop()
 * ```
 */
export function createClock(interval = 1000): Clock {
  let clockId: NodeJS.Timeout | null = null
  let subscribers: ((currentTime: Date) => void)[] = []

  const start = (): void => {
    if (clockId === null) {
      clockId = setInterval(() => {
        const currentTime = createDate()
        subscribers.forEach((subscriber) => subscriber(currentTime))
      }, interval)
    }
  }

  const stop = (): void => {
    if (clockId !== null) {
      clearInterval(clockId)
      clockId = null
    }
  }

  const subscribe = (callback: (currentTime: Date) => void): void => {
    subscribers.push(callback)
  }

  const unsubscribe = (callback: (currentTime: Date) => void): void => {
    subscribers = subscribers.filter((subscriber) => subscriber !== callback)
  }

  return freeze({ start, stop, subscribe, unsubscribe, interval })
}
