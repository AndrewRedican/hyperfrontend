/**
 * Generates a random number following a logarithmic distribution.
 *
 * @param scale - The scale parameter controlling the distribution spread
 * @returns A random number from the logarithmic distribution
 */
export function randomLogarithmic(scale: number): number {
  const u = Math.random()
  return Math.exp(scale * u)
}
