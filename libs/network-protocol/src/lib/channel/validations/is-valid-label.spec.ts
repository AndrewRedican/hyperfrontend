/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidLabel } from './is-valid-label'

describe('isValidLabel', () => {
  it('returns true for non empty string', () => {
    expect(isValidLabel('label')).toBe(true)
  })

  it('returns false for non empty string', () => {
    expect(isValidLabel(void 0 as any)).toBe(false)
    expect(isValidLabel(null as any)).toBe(false)
    expect(isValidLabel('')).toBe(false)
  })
})
