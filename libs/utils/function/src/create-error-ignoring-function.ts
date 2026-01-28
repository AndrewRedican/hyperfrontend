/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Creates a wrapper function that silently ignores any errors thrown by the wrapped void function.
 * This function is specifically for wrapping functions that do not return a value (void functions).
 * Exceptions are swallowed without any logging or handling.
 *
 * @param {Function} func - The void function to be wrapped.
 * @returns {Function} A wrapped version of the input function that ignores errors.
 */
export function createErrorIgnoringFunction<T extends (...args: any[]) => void>(func: T): (...args: Parameters<T>) => void {
  return function (...args: Parameters<T>): void {
    try {
      func(...args)
    } catch {
      // Deliberately swallowing/ignoring the exception
    }
  }
}
