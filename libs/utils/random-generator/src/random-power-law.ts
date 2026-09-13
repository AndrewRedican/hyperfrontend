import type { RandomSource } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { pow, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { isFinite } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/**
 * Generates a random number following a power law distribution within a specified range.
 *
 * @param alpha - The standard Pareto/Zipf exponent: higher values concentrate more mass near min. Values between 1 and 3 are typical, alpha of 1 gives a log-uniform draw, and alpha of 0 gives a uniform draw.
 * @param min - The minimum value of the range; must be a finite number greater than zero
 * @param max - The maximum value of the range; must be a finite number greater than zero
 * @param source - Where the unit draw comes from; defaults to the built-in `Math.random`
 * @returns A random number from the power law distribution bounded by min and max
 * @throws {Error} When `alpha`, `min` or `max` is `NaN` or infinite, or when `min` or `max` is not greater than zero.
 *
 * @example Simulating social network follower counts (few have many, many have few)
 * ```typescript
 * // alpha above 1 creates a long tail, so most values sit near min
 * const followerCount = randomPowerLaw(2.5, 1, 1000000)
 * // => 1.6 (typically low, occasionally very large)
 * ```
 *
 * @example Modeling file sizes in a system
 * ```typescript
 * const fileSizeKb = randomPowerLaw(2.0, 1, 10000)
 * // => 2 (many small files, rare large files)
 * ```
 *
 * @example Drawing from a seeded stream instead of `Math.random`
 * ```typescript
 * const { next } = createRandomGenerator(7)
 * const citySize = randomPowerLaw(1.1, 100, 1000000, next)
 * // => the same size on every run that seeds 7
 * ```
 */
export function randomPowerLaw(alpha: number, min: number, max: number, source: RandomSource = random): number {
  if (!isFinite(alpha) || !isFinite(min) || !isFinite(max)) {
    throw createError('Alpha, min and max must be finite numbers.')
  }

  // why: the inverse CDF takes arbitrary real powers of both bounds (and divides by min at alpha 1), so a bound at or below zero yields NaN or a draw outside the range.
  if (min <= 0 || max <= 0) {
    throw createError('Min and max must be greater than zero.')
  }

  const u = source()
  const exponent = 1 - alpha
  // why: at alpha exactly 1 the inverse CDF has a removable singularity whose limit is the log-uniform draw, and the closed form below divides by zero there.
  if (exponent === 0) {
    return min * pow(max / min, u)
  }
  const factor = (pow(max, exponent) - pow(min, exponent)) * u + pow(min, exponent)
  return pow(factor, 1 / exponent)
}
