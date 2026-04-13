/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * A no-operation function (noop) that does nothing regardless of the arguments passed.
 * It is designed to be as permissive as possible in its typing without using the `Function` keyword.
 *
 * @param args - Any arguments passed to the function (ignored)
 *
 * @example Using noop as fallback callback
 * ```typescript
 * const callback = condition ? handleEvent : noop
 * callback() // safely does nothing if condition is false
 * ```
 */
export const noop = (...args: unknown[]): void => {
  // Intentionally does nothing
}
