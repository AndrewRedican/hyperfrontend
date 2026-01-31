/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Creates a wrapper function around a given function to ensure that it can be executed only once.
 * The result of the first execution is stored and returned for all subsequent calls. This makes the function
 * ideal for use cases where a particular operation, such as an initialization or setup, must be performed
 * only once, and its result reused thereafter. This is useful in scenarios like setting up configurations,
 * initializing singletons, or similar one-time operations.
 *
 * @param func - The function to be wrapped for single execution.
 * @returns A wrapped version of the input function that executes once and returns the same result for all subsequent calls.
 */
export function createRunOnceFunction<T extends (...args: any[]) => any>(func: T): (...args: Parameters<T>) => ReturnType<T> {
  let hasRun = false
  let result: ReturnType<T>
  return function (...args: Parameters<T>): ReturnType<T> {
    if (hasRun) return result
    hasRun = true
    result = func(...args)
    return result
  }
}
