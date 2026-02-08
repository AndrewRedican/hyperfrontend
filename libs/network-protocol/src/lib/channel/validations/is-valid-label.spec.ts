/* eslint-disable @typescript-eslint/no-explicit-any */
import { isValidLabel } from './is-valid-label'

describe('isValidLabel', () => {
  it('returns true for non empty string', () => {
    expect(isValidLabel('label')).toBe(true)
  })

  it('returns false for non empty string', () => {
    expect(isValidLabel(<any>void 0)).toBe(false)
    expect(isValidLabel(<any>null)).toBe(false)
    expect(isValidLabel('')).toBe(false)
  })
})
