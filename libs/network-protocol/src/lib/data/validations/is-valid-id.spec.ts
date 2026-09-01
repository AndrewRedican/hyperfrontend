import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidId } from './is-valid-id'

describe('isValidId', () => {
  it('returns true for a valid process id', () => {
    expect(isValidId(uuidV4())).toBe(true)
  })

  it('returns false for an invalid process id', () => {
    expect(isValidId(void 0)).toBe(false)
    expect(isValidId(null)).toBe(false)
    expect(isValidId(0)).toBe(false)
    expect(isValidId('')).toBe(false)
    expect(isValidId('1sdfw4')).toBe(false)
    expect(isValidId({})).toBe(false)
  })
})
