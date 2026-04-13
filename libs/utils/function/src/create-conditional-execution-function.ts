/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Creates a wrapper function that only executes the wrapped function if the condition function returns true.
 *
 * @param func - The function to be conditionally executed.
 * @param conditionFunc - A function that returns a boolean, determining if `func` should be executed.
 * @returns A wrapped version of `func` that executes conditionally.
 *
 * @example Conditional logging based on flag
 * ```typescript
 * let enabled = false
 * const conditionalLog = createConditionalExecutionFunction(console.log, () => enabled)
 * conditionalLog('test') // does nothing
 * enabled = true
 * conditionalLog('test') // logs 'test'
 * ```
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
