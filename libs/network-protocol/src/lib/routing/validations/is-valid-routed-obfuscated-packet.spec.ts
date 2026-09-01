import { describe, expect, it } from '@hyperfrontend/testing'
import { routedObfuscatedPacket } from '../creators/mocks'
import { isValidRoutedObfuscatedPacket } from './is-valid-routed-obfuscated-packet'

describe('isValidRoutedObfuscatedPacket', () => {
  it('returns true for a valid routed obfuscated packet', () => {
    expect(isValidRoutedObfuscatedPacket(routedObfuscatedPacket)).toBe(true)
  })

  it('returns false for anything other than a valid routed obfuscated packet', () => {
    expect(isValidRoutedObfuscatedPacket(void 0)).toBe(false)
    expect(isValidRoutedObfuscatedPacket(null)).toBe(false)
    expect(isValidRoutedObfuscatedPacket([])).toBe(false)
    expect(isValidRoutedObfuscatedPacket({ topicId: '' })).toBe(false)
  })
})
