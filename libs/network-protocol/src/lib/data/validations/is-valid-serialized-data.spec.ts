import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidSerializedData } from './is-valid-serialized-data'

describe('isValidSerializedData', () => {
  it('returns true for valid data', () => {
    expect(isValidSerializedData('data')).toBe(true)
  })

  it('returns false for invalid data', () => {
    expect(isValidSerializedData(null)).toBe(false)
    expect(isValidSerializedData(void 0)).toBe(false)
    expect(isValidSerializedData(0)).toBe(false)
    expect(isValidSerializedData('')).toBe(false)
    expect(isValidSerializedData({})).toBe(false)
  })
})
