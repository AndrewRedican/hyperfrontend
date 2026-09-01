import type { UnobfuscatedPacket } from '../model'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

describe('isValidUnobfuscatedPacketBase', () => {
  it('returns false for invalid data types', () => {
    expect(isValidUnobfuscatedPacketBase(void 0).isValid).toBe(false)
    expect(isValidUnobfuscatedPacketBase(null).isValid).toBe(false)
    expect(isValidUnobfuscatedPacketBase('').isValid).toBe(false)
  })

  it('returns false for empty packet', () => {
    expect(isValidUnobfuscatedPacketBase({}).isValid).toBe(false)
  })

  it('returns true for a valid packet', () => {
    const packet: UnobfuscatedPacket = {
      origin: uuidV4(),
      target: uuidV4(),
      data: 'non-empty',
    }
    expect(isValidUnobfuscatedPacketBase(packet).isValid).toBe(true)
  })
})
