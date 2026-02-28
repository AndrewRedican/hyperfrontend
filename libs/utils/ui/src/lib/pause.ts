import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/**
 * Creates a promise that resolves after the specified delay, useful for pausing execution.
 *
 * @param timeMS - The delay in milliseconds
 * @returns A promise that resolves after the specified time
 */
export function pause(timeMS: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return createPromise((resolve, _) => setTimeout(() => resolve(void 0), timeMS))
}
