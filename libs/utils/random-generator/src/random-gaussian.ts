import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Generates a random number following a Gaussian (normal) distribution within a specified range.
 *
 * @param min - The minimum value of the range
 * @param max - The maximum value of the range
 * @returns A random number from the Gaussian distribution bounded by min and max
 */
export function randomGaussian(min: number, max: number): number {
  if (min > max) {
    throw createError('Min value should be less than or equal to max value.')
  }

  let u, v, s
  do {
    u = Math.random() * 2 - 1
    v = Math.random() * 2 - 1
    s = u * u + v * v
  } while (s >= 1 || s === 0)

  const std_dev = Math.sqrt((-2 * Math.log(s)) / s)
  const z0 = u * std_dev

  const mu = (min + max) / 2
  const sigma = (max - min) / 6

  const value = mu + z0 * sigma

  if (value >= min && value <= max) {
    return value
  } else {
    return randomGaussian(min, max)
  }
}

export default randomGaussian
