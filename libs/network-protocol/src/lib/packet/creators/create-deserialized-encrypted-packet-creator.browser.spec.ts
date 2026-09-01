import type { SerializedEncryptedPacket } from '../model'
import { base64ToUint8Array } from '@hyperfrontend/string-utils/browser'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createDeserializedEncryptedPacketCreator } from './create-deserialized-encrypted-packet-creator'
import { sampleSerializedPacket, sampleEncryptedData, packetSerializationTestCases, invalidPacketTestCases } from './test-fixtures'

describe('createDeserializedEncryptedPacketCreator (Browser)', () => {
  describe('valid packet deserialization', () => {
    it('deserializes a basic encrypted packet', () => {
      const createDeserializedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const result = createDeserializedPacket(sampleSerializedPacket)

      expect(result).toBeDefined()
      expect(result.origin).toBe(sampleSerializedPacket.origin)
      expect(result.target).toBe(sampleSerializedPacket.target)
      expect(result.data).toBeInstanceOf(Uint8Array)
      expect(result.data).toEqual(sampleEncryptedData)
    })

    packetSerializationTestCases.forEach(({ description, unserializedPacket, expectedSerializedData }) => {
      it(`deserializes ${description}`, () => {
        const createDeserializedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
        const serializedPacket: SerializedEncryptedPacket = {
          origin: unserializedPacket.origin,
          target: unserializedPacket.target,
          data: expectedSerializedData,
        }
        const result = createDeserializedPacket(serializedPacket)

        expect(result).toBeDefined()
        expect(result.origin).toBe(unserializedPacket.origin)
        expect(result.target).toBe(unserializedPacket.target)
        expect(result.data).toEqual(unserializedPacket.data)
      })
    })

    it('preserves all packet properties except data type', () => {
      const createDeserializedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const result = createDeserializedPacket(sampleSerializedPacket)

      expect(result.origin).toBe(sampleSerializedPacket.origin)
      expect(result.target).toBe(sampleSerializedPacket.target)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('produces consistent output for same input', () => {
      const createDeserializedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const result1 = createDeserializedPacket(sampleSerializedPacket)
      const result2 = createDeserializedPacket(sampleSerializedPacket)

      expect(result1.data).toEqual(result2.data)
      expect(result1.origin).toBe(result2.origin)
      expect(result1.target).toBe(result2.target)
    })

    it('returns frozen packet object', () => {
      const createDeserializedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const result = createDeserializedPacket(sampleSerializedPacket)

      expect(Object.isFrozen(result)).toBe(true)
    })
  })

  describe('error handling', () => {
    invalidPacketTestCases.forEach(({ description, packet }) => {
      it(`rejects ${description}`, () => {
        const createDeserializedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)

        expect(() => createDeserializedPacket(packet as SerializedEncryptedPacket)).toThrow('Cannot deserialize data of an invalid packet')
      })
    })

    it('handles decoding errors gracefully', () => {
      const mockDecode = () => {
        throw new Error('Decoding failed')
      }
      const createDeserializedPacket = createDeserializedEncryptedPacketCreator(mockDecode)

      expect(() => createDeserializedPacket(sampleSerializedPacket)).toThrow('Cannot deserialize packet encrypted data. Decoding failed')
    })

    it('handles invalid base64 string', () => {
      const createDeserializedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
      const invalidPacket: SerializedEncryptedPacket = {
        origin: 'test-origin',
        target: 'test-target',
        data: 'not-valid-base64!!!',
      }

      expect(() => createDeserializedPacket(invalidPacket)).toThrow()
    })

    it('handles null decoding function', () => {
      const createDeserializedPacket = createDeserializedEncryptedPacketCreator(null as unknown as typeof base64ToUint8Array)

      expect(() => createDeserializedPacket(sampleSerializedPacket)).toThrow()
    })

    it('handles undefined decoding function', () => {
      const createDeserializedPacket = createDeserializedEncryptedPacketCreator(undefined as unknown as typeof base64ToUint8Array)

      expect(() => createDeserializedPacket(sampleSerializedPacket)).toThrow()
    })
  })
})
