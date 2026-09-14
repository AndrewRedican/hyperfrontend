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

  it('draws from the given source instead of the default', () => {
    expect(randomExponential(2, () => 0.5)).toBeCloseTo(Math.log(2) / 2, 10)
  })

  it('rejects a lambda of zero', () => {
    expect(() => randomExponential(0)).toThrow('Lambda must be a positive finite number.')
  })

  it('rejects a negative lambda', () => {
    expect(() => randomExponential(-1)).toThrow('Lambda must be a positive finite number.')
  })

  it('rejects a NaN lambda', () => {
    expect(() => randomExponential(Number.NaN)).toThrow('Lambda must be a positive finite number.')
  })

  it('rejects an infinite lambda', () => {
    expect(() => randomExponential(Number.POSITIVE_INFINITY)).toThrow('Lambda must be a positive finite number.')
  })

  it('returns a positive zero at a unit draw of zero', () => {
    expect(randomExponential(2, () => 0)).toBe(0)
  })
})
