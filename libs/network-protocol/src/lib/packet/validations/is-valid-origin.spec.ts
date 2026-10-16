import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidOrigin } from './is-valid-origin'

describe('isValidOrigin', () => {
  it('returns true for valid origin', () => {
    expect(isValidOrigin(uuidV4())).toBe(true)
  })

  it.each([null, void 0, 5, {}, '', 'not-a-guid'])('returns false for the invalid origin %p', (value) => {
    expect(isValidOrigin(value)).toBe(false)
  })
})
