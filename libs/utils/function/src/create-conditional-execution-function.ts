/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Creates a wrapper function that only executes the wrapped function if the condition function returns true.
 * The wrapped function is called with the receiver the wrapper was invoked on, so a method wrapped in place
 * keeps its `this`.
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
 *
 * @example Gating a method you do not own
 * ```typescript
 * // an analytics client from a vendor SDK; track() keeps its state on the client itself
 * const analytics = { queue: [] as string[], track(event: string) { this.queue.push(event) } }
 * const consent = { granted: false }
 * analytics.track = createConditionalExecutionFunction(analytics.track, () => consent.granted)
 * analytics.track('page-view') // dropped while consent is withheld
 * consent.granted = true
 * analytics.track('click') // reaches the SDK method, which still finds its queue through `this`
 * ```
 */
export function createConditionalExecutionFunction<T extends (...args: any[]) => any>(
  func: T,
  conditionFunc: () => boolean
): (...args: Parameters<T>) => ReturnType<T> | void {
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> | void {
    if (conditionFunc()) {
      return func.apply(this, args)
    }
  }
}
