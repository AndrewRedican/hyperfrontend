import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidName } from './is-valid-name'

describe('isValidName', () => {
  it('returns true for any non-empty string', () => {
    expect(isValidName('name')).toBe(true)
  })

  it.each([void 0, null, '', 66, () => void 0, {}])('returns false for %p, which is not a non-empty string', (value) => {
    expect(isValidName(value)).toBe(false)
  })
})
