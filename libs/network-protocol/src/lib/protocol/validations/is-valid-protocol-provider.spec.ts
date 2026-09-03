import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidProtocolProvider } from './is-valid-protocol-provider'

describe('isValidProtocolProvider', () => {
  it('returns true for a function only', () => {
    expect(isValidProtocolProvider(40)).toBe(false)
    expect(isValidProtocolProvider(null)).toBe(false)
    expect(isValidProtocolProvider(void 0)).toBe(false)
    expect(isValidProtocolProvider({})).toBe(false)
    expect(isValidProtocolProvider(() => void 0)).toBe(true)
  })
})
