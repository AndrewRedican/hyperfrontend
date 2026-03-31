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

    expect(calculatedMean).toBeCloseTo((min + max) / 2, 1)
  })
})
