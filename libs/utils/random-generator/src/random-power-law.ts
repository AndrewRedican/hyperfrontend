import { pow, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following a power law distribution within a specified range.
 *
 * @param alpha - The power law exponent controlling the distribution
 * @param min - The minimum value of the range
 * @param max - The maximum value of the range
 * @returns A random number from the power law distribution bounded by min and max
 */
export function randomPowerLaw(alpha: number, min: number, max: number): number {
  const u = random()
  const factor = (pow(max, alpha - 1) - pow(min, alpha - 1)) * u + pow(min, alpha - 1)
  return pow(factor, 1 / (alpha - 1))
}
