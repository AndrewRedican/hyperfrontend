import { describe, expect, it } from '@hyperfrontend/testing'
import { dynamicRouting, staticRouting } from '../creators/mocks'
import { isValidRoutingOptions } from './is-valid-routing-options'

describe('isValidRoutingOptions', () => {
  it('returns true for valid static routing options', () => {
    expect(isValidRoutingOptions(staticRouting)).toBe(true)
  })

  it('returns true for valid dynamic routing options', () => {
    expect(isValidRoutingOptions(dynamicRouting)).toBe(true)
  })

  it.each([void 0, null, {}, { enabled: false }])('returns false for %p, which is not routing options', (value) => {
    expect(isValidRoutingOptions(value)).toBe(false)
  })
})
