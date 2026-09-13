/* eslint-disable @typescript-eslint/no-explicit-any */
import { noop } from './noop-function'

/**
 * Reports whether a value can be subscribed to as a promise.
 *
 * @param value - The value a wrapped function returned.
 * @returns True when the value exposes a `then` method.
 */
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | undefined)?.then === 'function'

/**
 * Creates a wrapper function that silently ignores any errors thrown by the wrapped void function.
 * This function is specifically for wrapping functions that do not return a value (void functions).
 * Exceptions are swallowed without any logging or handling, as is the rejection of a promise the function
 * returns. The wrapped function is called with the receiver the wrapper was invoked on, so a method wrapped
 * in place keeps its `this`.
 *
 * @param func - The void function to be wrapped.
 * @returns A wrapped version of the input function that ignores errors.
 *
 * @example Safely parsing invalid JSON
 * ```typescript
 * const safeParse = createErrorIgnoringFunction(() => JSON.parse('invalid'))
 * safeParse() // silently fails without throwing
 * ```
 *
 * @example Sending a beacon that may fail
 * ```typescript
 * const reportMetric = createErrorIgnoringFunction(async (name: string, value: number) => {
 *   await fetch('/metrics', { method: 'POST', body: JSON.stringify({ name, value }) })
 * })
 * reportMetric('render-ms', 12) // a failed request rejects the promise, and that rejection is ignored too
 * ```
 */
export function createErrorIgnoringFunction<T extends (...args: any[]) => void>(func: T): (...args: Parameters<T>) => void {
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
    try {
      const outcome: unknown = func.apply(this, args)
      if (isThenable(outcome)) {
        // why: the void signature also accepts an async function, whose rejection never reaches the catch below.
        outcome.then(undefined, noop)
      }
    } catch {
      // why: swallowing the failure is the whole purpose of the wrapper.
    }
  }
}
