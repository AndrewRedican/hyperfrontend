import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/**
 * Pauses execution for a specified duration.
 *
 * @param milliseconds - The duration to sleep in milliseconds
 * @returns A promise that resolves after the specified duration
 */
export function sleep(milliseconds: number): Promise<void> {
  return createPromise((resolve) => setTimeout(resolve, milliseconds))
}
