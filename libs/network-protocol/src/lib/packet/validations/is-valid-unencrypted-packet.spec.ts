import type { Mock } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { isValidUnencryptedData } from '../../data/validations/is-valid-unencrypted-data'
import { isValidUnencryptedPacket } from './is-valid-unencrypted-packet'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

jest.mock('./is-valid-unobfuscated-packet-base', () => ({
  isValidUnobfuscatedPacketBase: jest.fn(),
}))
jest.mock('../../data/validations/is-valid-unencrypted-data', () => ({
  isValidUnencryptedData: jest.fn(),
}))

describe('isValidDecryptedPacket', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true when packet is valid and data is decrypted correctly', () => {
    const data = {}
    ;(isValidUnobfuscatedPacketBase as Mock).mockImplementation(() => ({
      isValid: true,
      pkt: { data },
    }))
    ;(isValidUnencryptedData as Mock).mockImplementation(() => true)
    const packet = 'mocked packet'
    const result = isValidUnencryptedPacket(packet)
    expect(result).toBe(true)
    expect(isValidUnobfuscatedPacketBase).toHaveBeenCalledWith(packet)
    expect(isValidUnencryptedData).toHaveBeenCalledWith(data)
  })

  it('returns false when packet is invalid', () => {
    ;(isValidUnobfuscatedPacketBase as Mock).mockImplementation(() => ({
      isValid: false,
      pkt: { data: '' },
    }))
    const packet = 'mocked invalid packet'
    const result = isValidUnencryptedPacket(packet)
    expect(result).toBe(false)
    expect(isValidUnencryptedData).not.toHaveBeenCalled()
  })

  it('returns false when data is not serialized correctly', () => {
    ;(isValidUnobfuscatedPacketBase as Mock).mockImplementation(() => ({
      isValid: true,
      pkt: { data: 'invalid decrypted data' },
    }))
    ;(isValidUnencryptedData as Mock).mockImplementation(() => false)
    const packet = 'mocked packet with invalid data'
    const result = isValidUnencryptedPacket(packet)
    expect(result).toBe(false)
    expect(isValidUnencryptedData).toHaveBeenCalledWith('invalid decrypted data')
  })
})
