import { pow, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following a power law distribution within a specified range.
 *
 * @param alpha - The power law exponent controlling the distribution
 * @param min - The minimum value of the range
 * @param max - The maximum value of the range
 * @returns A random number from the power law distribution bounded by min and max
 *
 * @example Simulating social network follower counts (few have many, many have few)
 * ```typescript
 * // alpha > 2 creates "long tail" - most values near min
 * const followerCount = randomPowerLaw(2.5, 1, 1000000)
 * // => 127 (typically low, occasionally very large)
 * ```
 *
 * @example Modeling file sizes in a system
 * ```typescript
 * const fileSizeKb = randomPowerLaw(2.0, 1, 10000)
 * // => 45 (many small files, rare large files)
 * ```
 */
export function randomPowerLaw(alpha: number, min: number, max: number): number {
  const u = random()
  const factor = (pow(max, alpha - 1) - pow(min, alpha - 1)) * u + pow(min, alpha - 1)
  return pow(factor, 1 / (alpha - 1))
}
