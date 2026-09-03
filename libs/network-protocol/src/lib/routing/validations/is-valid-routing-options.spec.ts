import { describe, expect, it } from '@hyperfrontend/testing'
import { dynamicRouting, staticRouting } from '../creators/mocks'
import { isValidRoutingOptions } from './is-valid-routing-options'

describe('isValidRoutingOptions', () => {
  it('returns true for valid routing options', () => {
    expect(isValidRoutingOptions(staticRouting)).toBe(true)
    expect(isValidRoutingOptions(dynamicRouting)).toBe(true)
  })

  it('returms false for anything other than routing options', () => {
    expect(isValidRoutingOptions(void 0)).toBe(false)
    expect(isValidRoutingOptions(null)).toBe(false)
    expect(isValidRoutingOptions({})).toBe(false)
    expect(isValidRoutingOptions({ enabled: false })).toBe(false)
  })
})
