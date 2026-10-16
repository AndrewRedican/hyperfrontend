import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidSender } from './is-valid-sender'

describe('isValidSender', () => {
  it('returns true for a function', () => {
    expect(isValidSender(() => void 0)).toBe(true)
  })

  it.each([40, null, void 0, {}])('returns false for %p', (value) => {
    expect(isValidSender(value)).toBe(false)
  })
})
