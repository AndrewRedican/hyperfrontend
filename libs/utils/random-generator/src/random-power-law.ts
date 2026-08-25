import { pow, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following a power law distribution within a specified range.
 *
 * @param alpha - The standard Pareto/Zipf exponent: higher values concentrate more mass near min. Values between 1 and 3 are typical, alpha of 1 gives a log-uniform draw, and alpha of 0 gives a uniform draw.
 * @param min - The minimum value of the range
 * @param max - The maximum value of the range
 * @returns A random number from the power law distribution bounded by min and max
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
 */
export function randomPowerLaw(alpha: number, min: number, max: number): number {
  const u = random()
  const exponent = 1 - alpha
  // why: at alpha exactly 1 the inverse CDF has a removable singularity whose limit is the log-uniform draw, and the closed form below divides by zero there.
  if (exponent === 0) {
    return min * pow(max / min, u)
  }
  const factor = (pow(max, exponent) - pow(min, exponent)) * u + pow(min, exponent)
  return pow(factor, 1 / exponent)
}
