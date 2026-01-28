import { isValidSender } from './is-valid-sender'

describe('isValidSender', () => {
  it('returns true for a function only', () => {
    expect(isValidSender(40)).toBe(false)
    expect(isValidSender(null)).toBe(false)
    expect(isValidSender(void 0)).toBe(false)
    expect(isValidSender({})).toBe(false)
    expect(isValidSender(() => void 0)).toBe(true)
  })
})
