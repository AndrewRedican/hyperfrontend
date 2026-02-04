import { isValidSendFn } from './is-valid-send-fn'

describe('isValidSendFn', () => {
  it('returns true for a function', () => {
    expect(isValidSendFn(() => void 0)).toBe(true)
  })

  it('returns false for anything other than a function', () => {
    expect(isValidSendFn(void 0)).toBe(false)
    expect(isValidSendFn(null)).toBe(false)
    expect(isValidSendFn({})).toBe(false)
    expect(isValidSendFn(38)).toBe(false)
  })
})
