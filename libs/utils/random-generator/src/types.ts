/**
 * A source of unit draws: every call returns a number at or above 0 and below 1.
 *
 * Every distribution in this package takes one as its last parameter and defaults to the
 * built-in `Math.random`. Pass a seeded source, such as the `next` of a
 * {@link RandomGenerator}, and the draw becomes reproducible.
 */
export type RandomSource = () => number

/**
 * A seeded stream of random values.
 *
 * Two generators created from the same seed return the same values in the same order, for
 * every method, on every machine. All methods draw from the one stream, so the order of the
 * calls is part of what the seed reproduces.
 */
export interface RandomGenerator {
  /** The seed the stream was created from, kept so a run can be logged and replayed. */
  readonly seed: number
  /** Draws the next unit value: at or above 0 and below 1. Safe to pass around detached. */
  readonly next: RandomSource
  /**
   * Draws a value uniformly distributed between `min` (inclusive) and `max` (exclusive).
   *
   * @param min - The minimum value of the range (inclusive)
   * @param max - The maximum value of the range (exclusive)
   * @returns A value between min (inclusive) and max (exclusive)
   */
  uniform(min: number, max: number): number
  /**
   * Draws a value from a Gaussian (normal) distribution bounded by `min` and `max`.
   *
   * @param min - The minimum value of the range
   * @param max - The maximum value of the range
   * @returns A value clustered around the midpoint and never outside the range
   */
  gaussian(min: number, max: number): number
  /**
   * Draws a value from an exponential distribution.
   *
   * @param lambda - The rate parameter (λ) controlling the distribution shape
   * @returns A non-negative value whose mean is `1 / lambda`
   */
  exponential(lambda: number): number
  /**
   * Draws a value from a power law distribution bounded by `min` and `max`.
   *
   * @param alpha - The standard Pareto/Zipf exponent: higher values concentrate more mass near min
   * @param min - The minimum value of the range
   * @param max - The maximum value of the range
   * @returns A value between min and max, most often near min
   */
  powerLaw(alpha: number, min: number, max: number): number
  /**
   * Draws a value from a logarithmic distribution.
   *
   * @param scale - The scale parameter controlling the distribution spread
   * @returns A value between 1 and `e ^ scale`, skewed toward the low end
   */
  logarithmic(scale: number): number
  /**
   * Generates a version 4 UUID from the stream, so fixtures keep the same ids run to run.
   *
   * @returns A version 4 UUID
   */
  uuidV4(): string
}
