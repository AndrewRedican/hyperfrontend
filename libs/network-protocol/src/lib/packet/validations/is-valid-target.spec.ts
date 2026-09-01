import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidTarget } from './is-valid-target'

describe('isValidTarget', () => {
  it('returns true for valid target', () => {
    expect(isValidTarget(uuidV4())).toBe(true)
  })

  it('returns false for invalid target', () => {
    expect(isValidTarget(null)).toBe(false)
    expect(isValidTarget(void 0)).toBe(false)
    expect(isValidTarget(5)).toBe(false)
    expect(isValidTarget({})).toBe(false)
    expect(isValidTarget('')).toBe(false)
    expect(isValidTarget('not-a-guid')).toBe(false)
  })
})
