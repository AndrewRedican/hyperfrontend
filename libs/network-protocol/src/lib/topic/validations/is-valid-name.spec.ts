/* eslint-disable @typescript-eslint/no-explicit-any */
import { isValidName } from './is-valid-name'

describe('isValidName', () => {
  it('returns true for any non-empty string', () => {
    expect(isValidName('name')).toBe(true)
  })

  it('returns false for value that is not any non-empty string', () => {
    expect(isValidName(<any>void 0)).toBe(false)
    expect(isValidName(<any>null)).toBe(false)
    expect(isValidName('')).toBe(false)
    expect(isValidName(<any>66)).toBe(false)
    expect(isValidName(<any>(() => void 0))).toBe(false)
    expect(isValidName(<any>{})).toBe(false)
  })
})
