import { floor, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Hashes a seed to a pseudo-random number at or above 0 and below 1.
 *
 * This is a stateless hash, not a stream: one seed maps to one value, and calling it twice
 * with the same seed returns that value twice. To draw a reproducible sequence, or to seed the
 * distributions, use `createRandomGenerator` instead. When deriving several values from one
 * base seed here, give every property its own offset and keep one item's seeds clear of the
 * next item's, because two draws from the same number are the same number.
 *
 * @param seed - The seed for the hash.
 * @returns A pseudo-random number between 0 and 1.
 *
 * @example Reproducible random values for testing
 * ```typescript
 * // Same seed always yields the same result
 * randomPseudo(42)
 * // => 0.7845... (deterministic)
 *
 * randomPseudo(42)
 * // => 0.7845... (identical)
 *
 * randomPseudo(43)
 * // => 0.2525... (different seed, different result)
 * ```
 */
export function randomPseudo(seed: number): number {
  const x = sin(seed) * 10000
  return x - floor(x)
}
