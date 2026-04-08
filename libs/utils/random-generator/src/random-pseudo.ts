import { floor, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * A simple pseudo-random number generator.
 *
 * @param seed - The seed for the generator.
 * @returns A pseudo-random number between 0 and 1.
 *
 * @example Reproducible random values for testing
 * ```typescript
 * // Same seed always yields the same result
 * randomPseudo(42)
 * // => 0.6853... (deterministic)
 *
 * randomPseudo(42)
 * // => 0.6853... (identical)
 *
 * randomPseudo(43)
 * // => 0.1762... (different seed, different result)
 * ```
 */
export function randomPseudo(seed: number): number {
  const x = sin(seed) * 10000
  return x - floor(x)
}
