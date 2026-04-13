import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Creates a promise that resolves after the specified delay, useful for pausing execution.
 *
 * @param timeMS - The delay in milliseconds
 * @returns A promise that resolves after the specified time
 *
 * @example Implementing retry with backoff
 * ```typescript
 * async function fetchWithRetry(url: string, maxRetries: number) {
 *   for (let attempt = 0; attempt < maxRetries; attempt++) {
 *     try {
 *       return await fetch(url)
 *     } catch {
 *       await pause(1000 * Math.pow(2, attempt)) // Exponential backoff
 *     }
 *   }
 * }
 * ```
 */
export function pause(timeMS: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return createPromise((resolve, _) => setTimeout(() => resolve(void 0), timeMS))
}
