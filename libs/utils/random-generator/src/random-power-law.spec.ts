import { randomPowerLaw } from './random-power-law'

// why: the draws are unseeded, so every assertion here is a distributional property with wide margins rather than an exact value.
const medianOf = (alpha: number, min: number, max: number, sampleSize = 50000): number => {
  const draws: number[] = []
  for (let i = 0; i < sampleSize; i++) {
    draws.push(randomPowerLaw(alpha, min, max))
  }
  draws.sort((a, b) => a - b)
  return draws[Math.floor(sampleSize / 2)] ?? Number.NaN
}

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

    expect(calculatedMean).toBeGreaterThan(min)
    expect(calculatedMean).toBeLessThan(max)
  })

  it('treats alpha as the standard Pareto exponent, concentrating mass near min', () => {
    expect(medianOf(2.5, 1, 1000000)).toBeLessThan(10)
  })

  it('keeps every draw within the requested bounds', () => {
    for (const alpha of [0.5, 1, 2, 3]) {
      for (let i = 0; i < 1000; i++) {
        const value = randomPowerLaw(alpha, 5, 500)
        expect(value).toBeGreaterThanOrEqual(5)
        expect(value).toBeLessThanOrEqual(500)
      }
    }
  })

  it('falls back to a log-uniform draw at alpha of exactly 1', () => {
    const median = medianOf(1, 1, 1000000)

    expect(Number.isNaN(median)).toBe(false)
    // why: the log-uniform median is the geometric mean of the bounds, sqrt(1 * 1000000) = 1000.
    expect(median).toBeGreaterThan(700)
    expect(median).toBeLessThan(1400)
  })

  it('degenerates to a uniform draw at alpha of 0', () => {
    const median = medianOf(0, 1, 1000000)

    expect(median).toBeGreaterThan(450000)
    expect(median).toBeLessThan(550000)
  })

  it('shifts mass towards min as alpha increases', () => {
    const low = medianOf(0.5, 1, 1000000)
    const mid = medianOf(1.5, 1, 1000000)
    const high = medianOf(2.5, 1, 1000000)

    expect(mid).toBeLessThan(low)
    expect(high).toBeLessThan(mid)
  })
})
