import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidTarget } from './is-valid-target'

describe('isValidTarget', () => {
  it('returns true for valid target', () => {
    expect(isValidTarget(uuidV4())).toBe(true)
  })

  it.each([null, void 0, 5, {}, '', 'not-a-guid'])('returns false for the invalid target %p', (value) => {
    expect(isValidTarget(value)).toBe(false)
  })
})
