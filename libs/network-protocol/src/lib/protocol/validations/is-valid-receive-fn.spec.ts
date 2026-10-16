import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidReceiveFn } from './is-valid-receive-fn'

describe('isValidReceiveFn', () => {
  it('returns true for a function', () => {
    expect(isValidReceiveFn(() => void 0)).toBe(true)
  })

  it.each([void 0, null, {}, 38])('returns false for %p, which is not a function', (value) => {
    expect(isValidReceiveFn(value)).toBe(false)
  })
})
