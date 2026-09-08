import { describe, expect, it } from '@hyperfrontend/testing'
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

    expect(calculatedMean).toBeGreaterThan(1)
  })

  it('draws from the given source instead of the default', () => {
    expect(randomLogarithmic(2, () => 0.5)).toBeCloseTo(Math.E, 10)
  })
})
