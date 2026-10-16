import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidLabel } from './is-valid-label'

describe('isValidLabel', () => {
  it('returns true for non empty string', () => {
    expect(isValidLabel('label')).toBe(true)
  })

  it.each([void 0, null, ''])('returns false for %p', (value) => {
    expect(isValidLabel(value)).toBe(false)
  })
})
