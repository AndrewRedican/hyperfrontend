import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { setInterval, clearInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

export interface Clock {
  readonly start: () => void
  readonly stop: () => void
  readonly subscribe: (callback: (currentTime: Date) => void) => void
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
 */
export function createClock(interval = 1000): Clock {
  let clockId: NodeJS.Timeout | null = null
  let subscribers: ((currentTime: Date) => void)[] = []

  const start = (): void => {
    if (clockId === null) {
      clockId = setInterval(() => {
        const currentTime = new Date()
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
