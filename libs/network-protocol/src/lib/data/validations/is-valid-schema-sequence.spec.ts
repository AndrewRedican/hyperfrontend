import { isValidSequence } from './is-valid-schema-sequence'

describe('isValidSequence', () => {
  it('returns true for a valid sequence', () => {
    expect(isValidSequence(1)).toBe(true)
    expect(isValidSequence(234)).toBe(true)
  })

  it('returns false for an invalid sequence', () => {
    expect(isValidSequence(void 0)).toBe(false)
    expect(isValidSequence(null)).toBe(false)
    expect(isValidSequence(0)).toBe(false)
    expect(isValidSequence(-5)).toBe(false)
    expect(isValidSequence({})).toBe(false)
    expect(isValidSequence('14')).toBe(false)
  })
})
