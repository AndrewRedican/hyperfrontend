import { setInterval, clearInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Creates a repeating interval that invokes a callback function at regular intervals.
 *
 * @param callback - The function to invoke at each interval
 * @param interval - Time in milliseconds between each callback invocation
 * @returns A cleanup function that stops the interval when called
 *
 * @example Setting interval with cleanup
 * ```typescript
 * const stopPolling = setIntervalCallback(() => {
 *   fetchLatestData()
 * }, 5000)
 *
 * // Later: clean up when component unmounts
 * stopPolling()
 * ```
 */
export function setIntervalCallback(callback: () => void, interval: number): () => void {
  const timerId = setInterval(callback, interval)
  return (): void => clearInterval(timerId)
}
