import { random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number uniformly distributed within a specified range.
 *
 * @param min - The minimum value of the range (inclusive)
 * @param max - The maximum value of the range (exclusive)
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
 */
export function randomUniform(min: number, max: number): number {
  return random() * (max - min) + min
}
