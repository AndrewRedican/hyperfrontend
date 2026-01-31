import { randomPseudoTimeBased } from './random-pseudo-time-based'

describe('randomPseudoTimeBased', () => {
  it('produces deterministic output for the same seed time', () => {
    const seedTime = new Date('2024-01-01')
    const result1 = randomPseudoTimeBased(seedTime)
    const result2 = randomPseudoTimeBased(seedTime)
    expect(result1).toBe(result2)
  })

  it('produces different outputs for different seed times', () => {
    const seedTime1 = new Date('2024-01-01')
    const seedTime2 = new Date('2024-01-02')
    const result1 = randomPseudoTimeBased(seedTime1)
    const result2 = randomPseudoTimeBased(seedTime2)
    expect(result1).not.toBe(result2)
  })
})
