import type { RandomSource } from './types'
import { log, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following an exponential distribution.
 *
 * @param lambda - The rate parameter (λ) controlling the distribution shape
 * @param source - Where the unit draw comes from; defaults to the built-in `Math.random`
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
 *
 * @example Replaying the same arrival gaps from a seed
 * ```typescript
 * const { next } = createRandomGenerator(7)
 * const gapSeconds = randomExponential(0.5, next)
 * // => the same gap on every run that seeds 7
 * ```
 */
export function randomExponential(lambda: number, source: RandomSource = random): number {
  const u = source()
  return -log(1 - u) / lambda
}
