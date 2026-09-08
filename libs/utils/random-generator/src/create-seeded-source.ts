import type { RandomSource } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { floor, imul, trunc } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { isFinite } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/**
 * Folds any finite number into the single 32-bit word the generator keeps as state.
 *
 * @param seed - The seed to fold.
 * @returns A 32-bit integer that differs for the seeds a consumer is likely to reach for.
 */
function foldSeed(seed: number): number {
  const whole = floor(seed)
  // why: the state is one 32-bit word, so the integer's low word, its bits above 32, and its fraction each fold in; 1.5 then opens a stream of its own instead of collapsing onto 1, and -1 stays apart from 0.
  // magic: 0x9e3779b1 is the 32-bit golden ratio constant; scrambling the high word with it keeps 2 ** 32 from folding onto 1.
  return (whole | 0) ^ imul(trunc(whole / 4294967296), 0x9e3779b1) ^ (((seed - whole) * 4294967296) | 0)
}

/**
 * Creates a seeded source of unit draws.
 *
 * The stream is mulberry32: one 32-bit word of state, a period of 2^32 draws, and output
 * that holds up statistically for simulation and procedural work. It is not a cryptographic
 * generator.
 *
 * @param seed - Any finite number. The integer part, the fraction, and bits above 32 all contribute, so nearby and negative seeds open distinct streams.
 * @returns A source that returns the same sequence of values for the same seed.
 * @throws {Error} When the seed is `NaN` or infinite.
 *
 * @example Two sources from one seed agree draw for draw
 * ```typescript
 * const first = createSeededSource(42)
 * const second = createSeededSource(42)
 * first() === second() // => true, and so on for every later draw
 * ```
 */
export function createSeededSource(seed: number): RandomSource {
  if (!isFinite(seed)) {
    throw createError('Seed must be a finite number.')
  }
  let state = foldSeed(seed)
  return () => {
    // magic: 0x6d2b79f5 is mulberry32's increment; the two imul rounds below are its output mixer.
    state = (state + 0x6d2b79f5) | 0
    let mixed = imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}
