/**
 * Creates a repeating interval that invokes a callback function at regular intervals.
 *
 * @param callback - The function to invoke at each interval
 * @param interval - Time in milliseconds between each callback invocation
 * @returns A cleanup function that stops the interval when called
 */
export function setIntervalCallback(callback: () => void, interval: number): () => void {
  const timerId: NodeJS.Timeout = setInterval(callback, interval)
  return (): void => clearInterval(timerId)
}
