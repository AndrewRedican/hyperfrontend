import type { RandomGenerator } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSeededSource } from './create-seeded-source'
import { randomExponential } from './random-exponential'
import { randomGaussian } from './random-gaussian'
import { randomLogarithmic } from './random-logarithmic'
import { randomPowerLaw } from './random-power-law'
import { randomUniform } from './random-uniform'
import { uuidV4 } from './uuid-v4'

/**
 * Creates a seeded stream that replays every distribution in this package from one seed.
 *
 * The same seed gives the same values in the same order on every run and every machine, so a
 * procedural scene, a fixture set, or a simulation becomes a function of one number. The
 * methods share a single stream: interleave the calls differently and the values move, so
 * keep the draw order stable wherever reproducibility matters.
 *
 * @param seed - Any finite number. Nearby, fractional, and negative seeds all open distinct streams.
 * @returns A frozen generator whose `next` is a plain function, safe to hand to any distribution as its source.
 * @throws {Error} When the seed is `NaN` or infinite.
 *
 * @example The same scene on every load
 * ```typescript
 * const stream = createRandomGenerator(2026)
 * const trees = Array.from({ length: 40 }, () => ({
 *   x: stream.uniform(0, 800),
 *   height: stream.gaussian(60, 140),
 * }))
 * // => identical positions and heights on every run that seeds 2026
 * ```
 *
 * @example Replaying a failing property test
 * ```typescript
 * const stream = createRandomGenerator(Date.now())
 * const input = stream.powerLaw(2, 1, 10000)
 * // Log stream.seed when the assertion fails, then pass it back in to reproduce the exact input.
 * ```
 *
 * @example Seeding a free-standing distribution
 * ```typescript
 * const { next } = createRandomGenerator(7)
 * const wait = randomExponential(0.5, next)
 * ```
 */
export function createRandomGenerator(seed: number): RandomGenerator {
  const next = createSeededSource(seed)
  return freeze({
    seed,
    next,
    uniform: (min: number, max: number): number => randomUniform(min, max, next),
    gaussian: (min: number, max: number): number => randomGaussian(min, max, next),
    exponential: (lambda: number): number => randomExponential(lambda, next),
    powerLaw: (alpha: number, min: number, max: number): number => randomPowerLaw(alpha, min, max, next),
    logarithmic: (scale: number): number => randomLogarithmic(scale, next),
    uuidV4: (): string => uuidV4(next),
  })
}
