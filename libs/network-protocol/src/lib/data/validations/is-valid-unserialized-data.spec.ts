import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidUnserializedData } from './is-valid-unserialized-data'

describe('isValidUnserializedData', () => {
  it('returns true when data is instance of Uint8Array', () => {
    expect(isValidUnserializedData(new Uint8Array([1, 2, 3]))).toBe(true)
  })

  it('returns false when data is not instance of Uint8Array', () => {
    expect(isValidUnserializedData(void 0)).toBe(false)
    expect(isValidUnserializedData(null)).toBe(false)
    expect(isValidUnserializedData('')).toBe(false)
    expect(isValidUnserializedData([])).toBe(false)
  })
})
