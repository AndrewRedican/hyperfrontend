import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidSendFn } from './is-valid-send-fn'

describe('isValidSendFn', () => {
  it('returns true for a function', () => {
    expect(isValidSendFn(() => void 0)).toBe(true)
  })

  it.each([void 0, null, {}, 38])('returns false for %p, which is not a function', (value) => {
    expect(isValidSendFn(value)).toBe(false)
  })
})
