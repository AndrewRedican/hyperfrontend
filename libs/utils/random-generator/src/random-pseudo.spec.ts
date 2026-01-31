import { randomPseudo } from './random-pseudo'

describe('randomPseudo', () => {
  it('returns the same number for the same seed', () => {
    const seed = 123
    const result1 = randomPseudo(seed)
    const result2 = randomPseudo(seed)
    expect(result1).toBe(result2)
  })

  it('returns a number between 0 and 1', () => {
    const seed = 456
    const result = randomPseudo(seed)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(1)
  })

  it('returns different numbers for different seeds', () => {
    const seed1 = 789
    const seed2 = 890
    const result1 = randomPseudo(seed1)
    const result2 = randomPseudo(seed2)
    expect(result1).not.toBe(result2)
  })

  it('handles large seed values', () => {
    const seed = Number.MAX_SAFE_INTEGER
    const result = randomPseudo(seed)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(1)
  })

  it('handles negative seed values', () => {
    const seed = -123456
    const result = randomPseudo(seed)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(1)
  })
})
