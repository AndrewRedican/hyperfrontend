import { exp, random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number following a logarithmic distribution.
 *
 * @param scale - The scale parameter controlling the distribution spread
 * @returns A random number from the logarithmic distribution
 */
export function randomLogarithmic(scale: number): number {
  const u = random()
  return exp(scale * u)
}
