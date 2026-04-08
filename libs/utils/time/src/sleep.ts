import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Pauses execution for a specified duration.
 *
 * @param milliseconds - The duration to sleep in milliseconds
 * @returns A promise that resolves after the specified duration
 *
 * @example
 * ```typescript
 * async function retryWithBackoff(attempt: number) {
 *   const backoffMs = Math.min(1000 * 2 ** attempt, 30_000)
 *   await sleep(backoffMs)
 *   return fetchResource()
 * }
 * ```
 */
export function sleep(milliseconds: number): Promise<void> {
  return createPromise((resolve) => setTimeout(resolve, milliseconds))
}
