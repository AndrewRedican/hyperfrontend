/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidName } from './is-valid-name'

describe('isValidName', () => {
  it('returns true for any non-empty string', () => {
    expect(isValidName('name')).toBe(true)
  })

  it('returns false for value that is not any non-empty string', () => {
    expect(isValidName(void 0 as any)).toBe(false)
    expect(isValidName(null as any)).toBe(false)
    expect(isValidName('')).toBe(false)
    expect(isValidName(66 as any)).toBe(false)
    expect(isValidName((() => void 0) as any)).toBe(false)
    expect(isValidName({} as any)).toBe(false)
  })
})
