import { randomUniform } from './random-uniform'

describe('randomUniform', () => {
  it('generates numbers following a uniform distribution', () => {
    const min = 2
    const max = 8
    const sampleSize = 10000
    let sum = 0

    for (let i = 0; i < sampleSize; i++) {
      const num = randomUniform(min, max)
      sum += num
    }

    const calculatedMean = sum / sampleSize

    // Check if the calculated mean is close to the expected value.
    expect(calculatedMean).toBeCloseTo((min + max) / 2, 1)
  })
})
