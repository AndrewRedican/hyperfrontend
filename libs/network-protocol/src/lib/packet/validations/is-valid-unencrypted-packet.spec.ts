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
    ;(<jest.Mock>isValidUnobfuscatedPacketBase).mockImplementation(() => ({
      isValid: true,
      pkt: { data },
    }))
    ;(<jest.Mock>isValidUnencryptedData).mockImplementation(() => true)
    const packet = 'mocked packet'
    const result = isValidUnencryptedPacket(packet)
    expect(result).toBe(true)
    expect(isValidUnobfuscatedPacketBase).toHaveBeenCalledWith(packet)
    expect(isValidUnencryptedData).toHaveBeenCalledWith(data)
  })

  it('returns false when packet is invalid', () => {
    ;(<jest.Mock>isValidUnobfuscatedPacketBase).mockImplementation(() => ({
      isValid: false,
      pkt: { data: '' },
    }))
    const packet = 'mocked invalid packet'
    const result = isValidUnencryptedPacket(packet)
    expect(result).toBe(false)
    expect(isValidUnencryptedData).not.toHaveBeenCalled()
  })

  it('returns false when data is not serialized correctly', () => {
    ;(<jest.Mock>isValidUnobfuscatedPacketBase).mockImplementation(() => ({
      isValid: true,
      pkt: { data: 'invalid decrypted data' },
    }))
    ;(<jest.Mock>isValidUnencryptedData).mockImplementation(() => false)
    const packet = 'mocked packet with invalid data'
    const result = isValidUnencryptedPacket(packet)
    expect(result).toBe(false)
    expect(isValidUnencryptedData).toHaveBeenCalledWith('invalid decrypted data')
  })
})
