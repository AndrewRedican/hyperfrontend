import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { log, random, sqrt } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following a Gaussian (normal) distribution within a specified range.
 *
 * @param min - The minimum value of the range
 * @param max - The maximum value of the range
 * @returns A random number from the Gaussian distribution bounded by min and max
 *
 * @example Simulating human heights in centimeters
 * ```typescript
 * const heightCm = randomGaussian(150, 200)
 * // => 174.3 (most values cluster around the midpoint 175)
 * ```
 *
 * @example Generating test scores with realistic distribution
 * ```typescript
 * const testScore = randomGaussian(0, 100)
 * // => 52.8 (bell curve centered at 50, rarely hits extremes)
 * ```
 */
export function randomGaussian(min: number, max: number): number {
  if (min > max) {
    throw createError('Min value should be less than or equal to max value.')
  }

  let u, v, s
  do {
    u = random() * 2 - 1
    v = random() * 2 - 1
    s = u * u + v * v
  } while (s >= 1 || s === 0)

  const std_dev = sqrt((-2 * log(s)) / s)
  const z0 = u * std_dev

  const mu = (min + max) / 2
  const sigma = (max - min) / 6

  const value = mu + z0 * sigma

  if (value >= min && value <= max) {
    return value
  } else {
    return randomGaussian(min, max)
  }
}

export default randomGaussian
