import { randomPseudo } from './random-pseudo'

/**
 * Generates a deterministic pseudo-random variation based solely on the seed time.
 * @param seedTime - The seed time for the variation.
 * @returns The pseudo-random variation as a number.
 */
export function randomPseudoTimeBased(seedTime: Date): number {
  return randomPseudo(seedTime.getTime())
}
