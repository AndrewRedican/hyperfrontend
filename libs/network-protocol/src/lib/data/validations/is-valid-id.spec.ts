import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidId } from './is-valid-id'

describe('isValidId', () => {
  it('returns true for a valid process id', () => {
    expect(isValidId(uuidV4())).toBe(true)
  })

  it.each([void 0, null, 0, '', '1sdfw4', {}])('returns false for the invalid process id %p', (value) => {
    expect(isValidId(value)).toBe(false)
  })
})
