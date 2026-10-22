import { describe, expect, it } from '@hyperfrontend/testing'
import { validate } from './validate.ts'

describe('validate', () => {
  it('accepts a pattern the engine takes', () => {
    expect([validate('a+', ''), validate('\\p{L}', 'u'), validate('[a--b]', 'v')]).toEqual([null, null, null])
  })
  it('returns the constructor message for a pattern the engine refuses', () => {
    expect(validate('(', '')).toBe('Invalid regular expression: /(/: Unterminated group')
  })
  it('returns the constructor message for flags the engine refuses', () => {
    expect(validate('a', 'gg')).toBe("Invalid flags supplied to RegExp constructor 'gg'")
  })
})
