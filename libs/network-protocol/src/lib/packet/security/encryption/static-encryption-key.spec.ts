import type { UnencryptedPacket, UnserializedEncryptedPacket } from '../../../packet/model'
import { createStaticKeyEncryptionFactory } from './static-encryption-key'

describe('createStaticKeyEncryptionFactory', () => {
  let mockEncryptPacket: jest.Mock
  let mockDecryptPacket: jest.Mock

  beforeEach(() => {
    mockEncryptPacket = jest.fn().mockImplementation(async (packet, key) => ({
      ...packet,
      encrypted: true,
      usedKey: key,
    }))

    mockDecryptPacket = jest.fn().mockImplementation(async (packet, key) => ({
      ...packet,
      encrypted: false,
      usedKey: key,
    }))
  })

  describe('factory creation', () => {
    it('creates a factory function', () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      expect(typeof createEncryption).toBe('function')
    })

    it('returns an encryption suite with a valid key', () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      const suite = createEncryption('my-secret-key')

      expect(suite).toBeDefined()
      expect(typeof suite.packetEncryption).toBe('function')
      expect(typeof suite.packetDecryption).toBe('function')
    })

    it('throws error for empty key', () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      expect(() => createEncryption('')).toThrow('Static encryption key must be a non-empty string')
    })

    it('throws error for non-string key', () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      expect(() => createEncryption(null as string)).toThrow('Static encryption key must be a non-empty string')
      expect(() => createEncryption(undefined as string)).toThrow('Static encryption key must be a non-empty string')
      expect(() => createEncryption(123 as unknown as string)).toThrow('Static encryption key must be a non-empty string')
    })

    it('returns a frozen encryption suite', () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      const suite = createEncryption('my-secret-key')

      expect(Object.isFrozen(suite)).toBe(true)
    })
  })

  describe('encryption', () => {
    it('encrypts packet with the static key', async () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      const suite = createEncryption('my-secret-key')

      const packet = { origin: 'a', target: 'b', data: { message: 'hello' } } as unknown as UnencryptedPacket

      const result = await suite.packetEncryption(packet)

      expect(mockEncryptPacket).toHaveBeenCalledWith(packet, 'my-secret-key')
      expect(result).toMatchObject({ encrypted: true, usedKey: 'my-secret-key' })
    })

    it('always uses the same key for encryption', async () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      const suite = createEncryption('static-key')

      const packet1 = { origin: 'a', target: 'b', data: { message: 'first' } } as unknown as UnencryptedPacket
      const packet2 = { origin: 'a', target: 'b', data: { message: 'second' } } as unknown as UnencryptedPacket

      await suite.packetEncryption(packet1)
      await suite.packetEncryption(packet2)

      expect(mockEncryptPacket).toHaveBeenNthCalledWith(1, packet1, 'static-key')
      expect(mockEncryptPacket).toHaveBeenNthCalledWith(2, packet2, 'static-key')
    })
  })

  describe('decryption', () => {
    it('decrypts packet with the static key', async () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      const suite = createEncryption('my-secret-key')

      const packet = { origin: 'a', target: 'b', data: 'encrypted-data' } as unknown as UnserializedEncryptedPacket

      const result = await suite.packetDecryption(packet)

      expect(mockDecryptPacket).toHaveBeenCalledWith(packet, 'my-secret-key')
      expect(result).toMatchObject({ encrypted: false, usedKey: 'my-secret-key' })
    })

    it('always uses the same key for decryption', async () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)
      const suite = createEncryption('static-key')

      const packet1 = { origin: 'a', target: 'b', data: 'data1' } as unknown as UnserializedEncryptedPacket
      const packet2 = { origin: 'a', target: 'b', data: 'data2' } as unknown as UnserializedEncryptedPacket

      await suite.packetDecryption(packet1)
      await suite.packetDecryption(packet2)

      expect(mockDecryptPacket).toHaveBeenNthCalledWith(1, packet1, 'static-key')
      expect(mockDecryptPacket).toHaveBeenNthCalledWith(2, packet2, 'static-key')
    })
  })

  describe('different keys create independent suites', () => {
    it('creates separate encryption suites for different keys', async () => {
      const createEncryption = createStaticKeyEncryptionFactory(mockEncryptPacket, mockDecryptPacket)

      const suite1 = createEncryption('key-1')
      const suite2 = createEncryption('key-2')

      const packet = { origin: 'a', target: 'b', data: { message: 'test' } } as unknown as UnencryptedPacket

      await suite1.packetEncryption(packet)
      await suite2.packetEncryption(packet)

      expect(mockEncryptPacket).toHaveBeenNthCalledWith(1, packet, 'key-1')
      expect(mockEncryptPacket).toHaveBeenNthCalledWith(2, packet, 'key-2')
    })
  })
})
