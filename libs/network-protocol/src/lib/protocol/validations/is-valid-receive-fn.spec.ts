import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidReceiveFn } from './is-valid-receive-fn'

describe('isValidReceiveFn', () => {
  it('returns true for a function', () => {
    expect(isValidReceiveFn(() => void 0)).toBe(true)
  })

  it('returns false for anything other than a function', () => {
    expect(isValidReceiveFn(void 0)).toBe(false)
    expect(isValidReceiveFn(null)).toBe(false)
    expect(isValidReceiveFn({})).toBe(false)
    expect(isValidReceiveFn(38)).toBe(false)
  })
})
