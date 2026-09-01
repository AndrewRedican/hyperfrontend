import { describe, expect, it } from '@hyperfrontend/testing'
import { randomExponential } from './random-exponential'

describe('randomExponential', () => {
  it('generates numbers following an exponential distribution', () => {
    const lambda = 2
    const sampleSize = 10000
    let sum = 0

    for (let i = 0; i < sampleSize; i++) {
      const num = randomExponential(lambda)
      sum += num
    }

    const calculatedMean = sum / sampleSize

    expect(calculatedMean).toBeCloseTo(1 / lambda, 1)
  })
})
