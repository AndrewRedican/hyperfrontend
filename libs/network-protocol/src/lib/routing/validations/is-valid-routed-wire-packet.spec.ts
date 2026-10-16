import { describe, expect, it } from '@hyperfrontend/testing'
import { routedWirePacket } from '../creators/mocks'
import { isValidRoutedWirePacket } from './is-valid-routed-wire-packet'

describe('isValidRoutedWirePacket', () => {
  it('returns true for a valid routed wire packet', () => {
    expect(isValidRoutedWirePacket(routedWirePacket)).toBe(true)
  })

  // note: every row is wrapped in an array because a bare array row is spread across the test's parameters.
  it.each([[void 0], [null], [[]], [{ topicId: '' }]])('returns false for %p, which is not a valid routed wire packet', (value) => {
    expect(isValidRoutedWirePacket(value)).toBe(false)
  })
})
