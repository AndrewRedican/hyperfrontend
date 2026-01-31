import { isValidSerializedEncryptedPacket } from './is-valid-serialized-encrypted-packet'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'
import { isValidSerializedData } from '../../data/validations/is-valid-serialized-data'

jest.mock('./is-valid-unobfuscated-packet-base', () => ({
  isValidUnobfuscatedPacketBase: jest.fn(),
}))
jest.mock('../../data/validations/is-valid-serialized-data', () => ({
  isValidSerializedData: jest.fn(),
}))

describe('isValidSerializedEncryptedPacket', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true when packet is valid and data is serialized correctly', () => {
    ;(isValidUnobfuscatedPacketBase as jest.Mock).mockImplementation(() => ({
      isValid: true,
      pkt: { data: 'some serialized data' },
    }))
    ;(isValidSerializedData as jest.Mock).mockImplementation(() => true)
    const packet = 'mocked packet'
    const result = isValidSerializedEncryptedPacket(packet)
    expect(result).toBe(true)
    expect(isValidUnobfuscatedPacketBase).toHaveBeenCalledWith(packet)
    expect(isValidSerializedData).toHaveBeenCalledWith('some serialized data')
  })

  it('returns false when packet is invalid', () => {
    ;(isValidUnobfuscatedPacketBase as jest.Mock).mockImplementation(() => ({
      isValid: false,
      pkt: { data: '' },
    }))
    const packet = 'mocked invalid packet'
    const result = isValidSerializedEncryptedPacket(packet)
    expect(result).toBe(false)
    expect(isValidSerializedData).not.toHaveBeenCalled()
  })

  it('returns false when data is not serialized correctly', () => {
    ;(isValidUnobfuscatedPacketBase as jest.Mock).mockImplementation(() => ({
      isValid: true,
      pkt: { data: 'invalid serialized data' },
    }))
    ;(isValidSerializedData as jest.Mock).mockImplementation(() => false)
    const packet = 'mocked packet with invalid data'
    const result = isValidSerializedEncryptedPacket(packet)
    expect(result).toBe(false)
    expect(isValidSerializedData).toHaveBeenCalledWith('invalid serialized data')
  })
})
