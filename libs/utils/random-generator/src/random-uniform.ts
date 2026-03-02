import { random } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Generates a random number uniformly distributed within a specified range.
 *
 * @param min - The minimum value of the range (inclusive)
 * @param max - The maximum value of the range (exclusive)
 * @returns A random number between min (inclusive) and max (exclusive)
 */
export function randomUniform(min: number, max: number): number {
  return random() * (max - min) + min
}
