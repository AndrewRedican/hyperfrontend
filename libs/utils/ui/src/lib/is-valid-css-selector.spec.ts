import { isValidCssSelector } from './is-valid-css-selector'

describe('isValidCssSelector', () => {
  it('returns true when valid css selector is valid', () => {
    expect(isValidCssSelector('#id')).toBe(true)
    expect(isValidCssSelector("[id='value']")).toBe(true)
  })

  it('returns false when valid css selector is not valid', () => {
    expect(isValidCssSelector('')).toBe(false)
    expect(isValidCssSelector('"')).toBe(false)
    expect(isValidCssSelector(',')).toBe(false)
    expect(isValidCssSelector(':')).toBe(false)
    expect(isValidCssSelector(' ')).toBe(false)
  })
})
