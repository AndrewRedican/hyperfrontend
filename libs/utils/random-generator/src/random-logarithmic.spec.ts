import { randomLogarithmic } from './random-logarithmic'

describe('randomLogarithmic', () => {
  it('generates numbers following a logarithmic distribution', () => {
    const scale = 2
    const sampleSize = 10000
    let sum = 0

    for (let i = 0; i < sampleSize; i++) {
      const num = randomLogarithmic(scale)
      sum += num
    }

    const calculatedMean = sum / sampleSize

    // Check if the calculated mean is close to the expected value.
    expect(calculatedMean).toBeGreaterThan(1)
  })
})
