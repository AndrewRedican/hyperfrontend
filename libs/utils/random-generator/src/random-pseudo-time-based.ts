import { randomPseudo } from './random-pseudo'

/**
 * Generates a deterministic pseudo-random variation based solely on the seed time.
 *
 * @param seedTime - The seed time for the variation.
 * @returns The pseudo-random variation as a number.
 *
 * @example Reproducible randomness for a specific timestamp
 * ```typescript
 * const releaseDate = new Date('2024-03-15T10:30:00Z')
 *
 * // Same date always produces the same result
 * const value1 = randomPseudoTimeBased(releaseDate)
 * const value2 = randomPseudoTimeBased(releaseDate)
 * // value1 === value2 (deterministic)
 * ```
 */
export function randomPseudoTimeBased(seedTime: Date): number {
  return randomPseudo(seedTime.getTime())
}
