import type { RandomSource } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { log, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { isFinite } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/**
 * Generates a random number following an exponential distribution.
 *
 * @param lambda - The rate parameter (λ) controlling the distribution shape; must be a positive finite number
 * @param source - Where the unit draw comes from; defaults to the built-in `Math.random`
 * @returns A random number from the exponential distribution
 * @throws {Error} When `lambda` is zero, negative, `NaN` or infinite.
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
  if (!isFinite(lambda) || lambda <= 0) {
    throw createError('Lambda must be a positive finite number.')
  }

  const u = source()
  const value = -log(1 - u) / lambda
  // why: a unit draw of exactly 0 makes the quotient -0, and the distribution promises a non-negative value.
  return value === 0 ? 0 : value
}
