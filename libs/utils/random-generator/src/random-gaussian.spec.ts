import randomGaussian from './random-gaussian'

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
