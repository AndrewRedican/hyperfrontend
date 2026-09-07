import type { RandomSource } from './types'
import { exp, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following a logarithmic distribution.
 *
 * @param scale - The scale parameter controlling the distribution spread
 * @param source - Where the unit draw comes from; defaults to the built-in `Math.random`
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
 *
 * @example Drawing from a seeded stream instead of `Math.random`
 * ```typescript
 * const { next } = createRandomGenerator(7)
 * const growth = randomLogarithmic(5, next)
 * // => the same value on every run that seeds 7
 * ```
 */
export function randomLogarithmic(scale: number, source: RandomSource = random): number {
  const u = source()
  return exp(scale * u)
}
