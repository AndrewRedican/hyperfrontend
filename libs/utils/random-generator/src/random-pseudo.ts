import { floor, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * A simple pseudo-random number generator.
 *
 * @param seed - The seed for the generator.
 * @returns A pseudo-random number between 0 and 1.
 */
export function randomPseudo(seed: number): number {
  const x = sin(seed) * 10000
  return x - floor(x)
}
