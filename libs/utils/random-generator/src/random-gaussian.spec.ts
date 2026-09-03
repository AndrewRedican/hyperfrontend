import { describe, expect, it, jest } from '@hyperfrontend/testing'
import randomGaussian from './random-gaussian'

// why: An unseeded source failed about one run in a hundred here, because rejecting out-of-range draws truncates the tail and pulls the sample deviation below sigma before sampling noise is even counted; a fixed stream makes both moments exactly reproducible.
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/math', () => {
  const actual = jest.requireActual('@hyperfrontend/immutable-api-utils/built-in-copy/math')
  let seed = 1
  return {
    ...actual,
    random: () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    },
  }
})

describe('randomGaussian', () => {
  it('returns a number within the min and max values', () => {
    const min = 10
    const max = 20
    const value = randomGaussian(min, max)
    expect(value).toBeGreaterThanOrEqual(min)
    expect(value).toBeLessThanOrEqual(max)
  })

  it('generates values with a normal distribution', () => {
    const min = 10
    const max = 20
    const n = 10000
    const values: number[] = []

    for (let i = 0; i < n; i++) {
      values.push(randomGaussian(min, max))
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / n
    const mu = (min + max) / 2
    expect(mean).toBeCloseTo(mu, 1)

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n
    const sigma = (max - min) / 6
    expect(Math.sqrt(variance)).toBeCloseTo(sigma, 1)
  })

  it('throws an error if min is greater than max', () => {
    const min = 20
    const max = 10
    expect(() => randomGaussian(min, max)).toThrow('Min value should be less than or equal to max value.')
  })
})
