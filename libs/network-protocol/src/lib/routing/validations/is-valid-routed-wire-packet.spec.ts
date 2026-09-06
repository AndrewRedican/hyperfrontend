import { describe, expect, it } from '@hyperfrontend/testing'
import { routedWirePacket } from '../creators/mocks'
import { isValidRoutedWirePacket } from './is-valid-routed-wire-packet'

describe('isValidRoutedWirePacket', () => {
  it('returns true for a valid routed wire packet', () => {
    expect(isValidRoutedWirePacket(routedWirePacket)).toBe(true)
  })

  it('returns false for anything other than a valid routed wire packet', () => {
    expect(isValidRoutedWirePacket(void 0)).toBe(false)
    expect(isValidRoutedWirePacket(null)).toBe(false)
    expect(isValidRoutedWirePacket([])).toBe(false)
    expect(isValidRoutedWirePacket({ topicId: '' })).toBe(false)
  })
})
