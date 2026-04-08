import { log, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following an exponential distribution.
 *
 * @param lambda - The rate parameter (λ) controlling the distribution shape
 * @returns A random number from the exponential distribution
 *
 * @example Modeling time between events (e.g., customer arrivals)
 * ```typescript
 * // Higher lambda = shorter average wait time
 * const averageWaitMinutes = 5
 * const lambda = 1 / averageWaitMinutes
 * const waitTime = randomExponential(lambda)
 * // => 3.7 (varies each call, most values clustered near 0-10)
 * ```
 */
export function randomExponential(lambda: number): number {
  const u = random()
  return -log(1 - u) / lambda
}
