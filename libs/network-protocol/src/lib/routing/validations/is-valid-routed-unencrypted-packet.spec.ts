import { describe, expect, it } from '@hyperfrontend/testing'
import { routedUnencryptedPacket } from '../creators/mocks'
import { isValidRoutedUnencryptedPacket } from './is-valid-routed-unencrypted-packet'

describe('isValidRoutedUnencryptedPacket', () => {
  it('returns true for a valid routed unencrypted packet', () => {
    expect(isValidRoutedUnencryptedPacket(routedUnencryptedPacket)).toBe(true)
  })

  // note: every row is wrapped in an array because a bare array row is spread across the test's parameters.
  it.each([[void 0], [null], [[]], [{ topicId: '' }]])('returns false for %p, which is not a valid routed unencrypted packet', (value) => {
    expect(isValidRoutedUnencryptedPacket(value)).toBe(false)
  })
})
