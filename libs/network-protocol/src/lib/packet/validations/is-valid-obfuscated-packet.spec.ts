import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidObfuscatedPacket } from './is-valid-obfuscated-packet'

describe('isValidObfuscatedPacket', () => {
  it('returns true when value is Uint8Array', () => {
    expect(isValidObfuscatedPacket(new Uint8Array([1, 2, 3]))).toBe(true)
  })

  it('returns false when value is not Uint8Array', () => {
    expect(isValidObfuscatedPacket(void 0)).toBe(false)
    expect(isValidObfuscatedPacket(null)).toBe(false)
    expect(isValidObfuscatedPacket('qwerty')).toBe(false)
    expect(isValidObfuscatedPacket({})).toBe(false)
  })
})
