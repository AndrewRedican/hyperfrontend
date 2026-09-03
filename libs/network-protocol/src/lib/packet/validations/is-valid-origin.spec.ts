import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidOrigin } from './is-valid-origin'

describe('isValidOrigin', () => {
  it('returns true for valid origin', () => {
    expect(isValidOrigin(uuidV4())).toBe(true)
  })

  it('returns false for invalid origin', () => {
    expect(isValidOrigin(null)).toBe(false)
    expect(isValidOrigin(void 0)).toBe(false)
    expect(isValidOrigin(5)).toBe(false)
    expect(isValidOrigin({})).toBe(false)
    expect(isValidOrigin('')).toBe(false)
    expect(isValidOrigin('not-a-guid')).toBe(false)
  })
})
