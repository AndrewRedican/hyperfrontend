import { exp, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following a logarithmic distribution.
 *
 * @param scale - The scale parameter controlling the distribution spread
 * @returns A random number from the logarithmic distribution
 *
 * @example Generating values with exponential growth characteristics
 * ```typescript
 * // scale=1 produces values from 1 to e (~2.718)
 * const smallScale = randomLogarithmic(1)
 * // => 1.8 (values between 1 and ~2.7)
 *
 * // scale=5 produces values from 1 to e^5 (~148)
 * const largeScale = randomLogarithmic(5)
 * // => 42.3 (wider range, skewed toward lower values)
 * ```
 */
export function randomLogarithmic(scale: number): number {
  const u = random()
  return exp(scale * u)
}
