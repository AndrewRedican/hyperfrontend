/**
 * Generates a random number following an exponential distribution.
 *
 * @param lambda - The rate parameter (λ) controlling the distribution shape
 * @returns A random number from the exponential distribution
 */
export function randomExponential(lambda: number): number {
  const u = Math.random()
  return -Math.log(1 - u) / lambda
}
