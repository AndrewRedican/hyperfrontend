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
 * @param callback
 * @param delay time in milliseconds to wait until callback is invoked
 * @returns
 */
export function createTimer(callback: () => void, delay: number): Timer {
  let timerId: NodeJS.Timeout | null = null
  let start: number | null = null
  let remaining: number = delay

  const pause = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId)
      const now = Date.now()
      /* istanbul ignore else - start is always set when timerId is not null */
      if (start !== null) {
        remaining -= now - start
      }
      timerId = null
    }
  }

  const resume = (): void => {
    if (timerId === null) {
      start = Date.now()
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

  return Object.freeze({ pause, resume, reset })
}
