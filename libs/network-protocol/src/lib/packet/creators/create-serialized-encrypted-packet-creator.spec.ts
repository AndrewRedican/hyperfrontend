/**
 * Node.js tests for serialized encrypted packet creator.
 * Browser version: create-serialized-encrypted-packet-creator.browser.spec.ts (identical except for imports)
 */

import type { UnserializedEncryptedPacket } from '../model'
import { uint8ArrayToBase64 } from '@hyperfrontend/string-utils/node'
import { createSerializedEncryptedPacketCreator } from './create-serialized-encrypted-packet-creator'
import { sampleUnserializedPacket, packetSerializationTestCases, invalidPacketTestCases } from './test-fixtures'

describe('createSerializedEncryptedPacketCreator (Node.js)', () => {
  describe('valid packet serialization', () => {
    it('serializes a basic encrypted packet', () => {
      const createSerializedPacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const result = createSerializedPacket(sampleUnserializedPacket)

      expect(result).toBeDefined()
      expect(result.origin).toBe(sampleUnserializedPacket.origin)
      expect(result.target).toBe(sampleUnserializedPacket.target)
      expect(typeof result.data).toBe('string')
      expect(result.data.length).toBeGreaterThan(0)
    })

    packetSerializationTestCases.forEach(({ description, unserializedPacket, expectedSerializedData }) => {
      it(`serializes ${description}`, () => {
        const createSerializedPacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
        const result = createSerializedPacket(<UnserializedEncryptedPacket>unserializedPacket)

        expect(result).toBeDefined()
        expect(result.origin).toBe(unserializedPacket.origin)
        expect(result.target).toBe(unserializedPacket.target)
        expect(result.data).toBe(expectedSerializedData)
      })
    })

    it('preserves all packet properties except data type', () => {
      const createSerializedPacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const result = createSerializedPacket(sampleUnserializedPacket)

      expect(result.origin).toBe(sampleUnserializedPacket.origin)
      expect(result.target).toBe(sampleUnserializedPacket.target)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('produces consistent output for same input', () => {
      const createSerializedPacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const result1 = createSerializedPacket(sampleUnserializedPacket)
      const result2 = createSerializedPacket(sampleUnserializedPacket)

      expect(result1.data).toBe(result2.data)
      expect(result1.origin).toBe(result2.origin)
      expect(result1.target).toBe(result2.target)
    })

    it('returns frozen packet object', () => {
      const createSerializedPacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
      const result = createSerializedPacket(sampleUnserializedPacket)

      expect(Object.isFrozen(result)).toBe(true)
    })
  })

  describe('error handling', () => {
    invalidPacketTestCases.forEach(({ description, packet }) => {
      it(`rejects ${description}`, () => {
        const createSerializedPacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)

        expect(() => createSerializedPacket(<UnserializedEncryptedPacket>packet)).toThrow('Cannot serialize data of an invalid packet')
      })
    })

    it('handles encoding errors gracefully', () => {
      const mockEncode = () => {
        throw new Error('Encoding failed')
      }
      const createSerializedPacket = createSerializedEncryptedPacketCreator(mockEncode)

      expect(() => createSerializedPacket(sampleUnserializedPacket)).toThrow('Cannot serialize packet encrypted data. Encoding failed')
    })

    it('handles null encoding function', () => {
      const createSerializedPacket = createSerializedEncryptedPacketCreator(<typeof uint8ArrayToBase64>(<unknown>null))

      expect(() => createSerializedPacket(sampleUnserializedPacket)).toThrow()
    })

    it('handles undefined encoding function', () => {
      const createSerializedPacket = createSerializedEncryptedPacketCreator(<typeof uint8ArrayToBase64>(<unknown>undefined))

      expect(() => createSerializedPacket(sampleUnserializedPacket)).toThrow()
    })
  })
})
