import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidProtocolProvider } from './is-valid-protocol-provider'

describe('isValidProtocolProvider', () => {
  it('returns true for a function', () => {
    expect(isValidProtocolProvider(() => void 0)).toBe(true)
  })

  it.each([40, null, void 0, {}])('returns false for %p', (value) => {
    expect(isValidProtocolProvider(value)).toBe(false)
  })
})
