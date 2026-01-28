/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Creates a wrapper function that only executes the wrapped function if the condition function returns true.
 *
 * @param {Function} func - The function to be conditionally executed.
 * @param {Function} conditionFunc - A function that returns a boolean, determining if `func` should be executed.
 * @returns {Function} A wrapped version of `func` that executes conditionally.
 */
export function createConditionalExecutionFunction<T extends (...args: any[]) => any>(
  func: T,
  conditionFunc: () => boolean
): (...args: Parameters<T>) => ReturnType<T> | void {
  return function (...args: Parameters<T>): ReturnType<T> | void {
    if (conditionFunc()) {
      return func(...args)
    }
  }
}
