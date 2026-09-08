import type { RandomSource } from './types'
import { random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number uniformly distributed within a specified range.
 *
 * @param min - The minimum value of the range (inclusive)
 * @param max - The maximum value of the range (exclusive)
 * @param source - Where the unit draw comes from; defaults to the built-in `Math.random`
 * @returns A random number between min (inclusive) and max (exclusive)
 *
 * @example Generating a random price within a budget range
 * ```typescript
 * const priceUsd = randomUniform(10, 50)
 * // => 27.34 (any value equally likely within range)
 * ```
 *
 * @example Random coordinates for game object placement
 * ```typescript
 * const xPosition = randomUniform(0, 800)
 * const yPosition = randomUniform(0, 600)
 * // => x: 342.7, y: 198.2
 * ```
 *
 * @example Drawing from a seeded stream instead of `Math.random`
 * ```typescript
 * const { next } = createRandomGenerator(7)
 * const startAngle = randomUniform(0, 360, next)
 * // => the same angle on every run that seeds 7
 * ```
 */
export function randomUniform(min: number, max: number, source: RandomSource = random): number {
  return source() * (max - min) + min
}
