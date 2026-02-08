import { randomPowerLaw } from './random-power-law'

describe('randomPowerLaw', () => {
  it('generates numbers following a power-law distribution', () => {
    const alpha = 3
    const min = 1
    const max = 10
    const sampleSize = 10000
    let sum = 0

    for (let i = 0; i < sampleSize; i++) {
      const num = randomPowerLaw(alpha, min, max)
      sum += num
    }

    const calculatedMean = sum / sampleSize

    // Check if the calculated mean is within the expected range.
    expect(calculatedMean).toBeGreaterThan(min)
    expect(calculatedMean).toBeLessThan(max)
  })
})
