import { isValidUnserializedEncryptedPacket } from './is-valid-unserialized-encrypted-packet'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'
import { isValidUnserializedData } from '../../data/validations/is-valid-unserialized-data'

jest.mock('./is-valid-unobfuscated-packet-base', () => ({
  isValidUnobfuscatedPacketBase: jest.fn(),
}))
jest.mock('../../data/validations/is-valid-unserialized-data', () => ({
  isValidUnserializedData: jest.fn(),
}))

describe('isValidDeserialzedEncryptedPacket', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true when packet is valid and data is deserialized correctly', () => {
    const data = new Uint8Array([1, 2, 3])
    ;(isValidUnobfuscatedPacketBase as jest.Mock).mockImplementation(() => ({
      isValid: true,
      pkt: { data },
    }))
    ;(isValidUnserializedData as jest.Mock).mockImplementation(() => true)
    const packet = 'mocked packet'
    const result = isValidUnserializedEncryptedPacket(packet)
    expect(result).toBe(true)
    expect(isValidUnobfuscatedPacketBase).toHaveBeenCalledWith(packet)
    expect(isValidUnserializedData).toHaveBeenCalledWith(data)
  })

  it('returns false when packet is invalid', () => {
    ;(isValidUnobfuscatedPacketBase as jest.Mock).mockImplementation(() => ({
      isValid: false,
      pkt: { data: '' },
    }))
    const packet = 'mocked invalid packet'
    const result = isValidUnserializedEncryptedPacket(packet)
    expect(result).toBe(false)
    expect(isValidUnserializedData).not.toHaveBeenCalled()
  })

  it('returns false when data is not serialized correctly', () => {
    ;(isValidUnobfuscatedPacketBase as jest.Mock).mockImplementation(() => ({
      isValid: true,
      pkt: { data: 'invalid deserialized data' },
    }))
    ;(isValidUnserializedData as jest.Mock).mockImplementation(() => false)
    const packet = 'mocked packet with invalid data'
    const result = isValidUnserializedEncryptedPacket(packet)
    expect(result).toBe(false)
    expect(isValidUnserializedData).toHaveBeenCalledWith('invalid deserialized data')
  })
})
