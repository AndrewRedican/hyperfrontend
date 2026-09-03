import type { ObfuscatedPacket } from '../../model'
import { encrypt, decrypt } from '@hyperfrontend/cryptography/node'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createPacketDeobfuscator } from './create-deobfuscator'
import { createPacketObfuscator } from './create-obfuscator'
import { testPasswords, testUUIDs, sampleSerializedEncryptedPacket, alternativeSerializedEncryptedPacket } from './test-fixtures'

describe('createPacketDeobfuscator (Node.js)', () => {
  describe('valid deobfuscation', () => {
    it('deobfuscates standard packet with valid password', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const obfuscated = await obfuscatePacket(sampleSerializedEncryptedPacket, testPasswords.valid)
      const result = await deobfuscatePacket(obfuscated, testPasswords.valid)

      expect(result.origin).toBe(sampleSerializedEncryptedPacket.origin)
      expect(result.target).toBe(sampleSerializedEncryptedPacket.target)
      expect(result.data).toBe(sampleSerializedEncryptedPacket.data)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('deobfuscates packet with alternative password', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const obfuscated = await obfuscatePacket(alternativeSerializedEncryptedPacket, testPasswords.alternative)
      const result = await deobfuscatePacket(obfuscated, testPasswords.alternative)

      expect(result.origin).toBe(alternativeSerializedEncryptedPacket.origin)
      expect(result.target).toBe(alternativeSerializedEncryptedPacket.target)
      expect(result.data).toBe(alternativeSerializedEncryptedPacket.data)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('deobfuscates packet with minimal data', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const minimalPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target2,
        data: 'x',
      }

      const obfuscated = await obfuscatePacket(minimalPacket, testPasswords.valid)
      const result = await deobfuscatePacket(obfuscated, testPasswords.valid)

      expect(result.origin).toBe(minimalPacket.origin)
      expect(result.target).toBe(minimalPacket.target)
      expect(result.data).toBe(minimalPacket.data)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('deobfuscates packet with long data', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const longDataPacket = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target1,
        data: 'a'.repeat(1000),
      }

      const obfuscated = await obfuscatePacket(longDataPacket, testPasswords.valid)
      const result = await deobfuscatePacket(obfuscated, testPasswords.valid)

      expect(result.origin).toBe(longDataPacket.origin)
      expect(result.target).toBe(longDataPacket.target)
      expect(result.data).toBe(longDataPacket.data)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('fails with wrong password', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const obfuscated = await obfuscatePacket(sampleSerializedEncryptedPacket, testPasswords.valid)

      await expect(deobfuscatePacket(obfuscated, 'wrong-password')).rejects.toThrow('Cannot deobfuscate packet')
    })

    it('preserves origin and target fields', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const packet = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target2,
        data: 'test-data-123',
      }

      const obfuscated = await obfuscatePacket(packet, testPasswords.valid)
      const result = await deobfuscatePacket(obfuscated, testPasswords.valid)

      expect(result.origin).toBe(testUUIDs.origin2)
      expect(result.target).toBe(testUUIDs.target2)
    })
  })

  describe('error handling', () => {
    it('handles null packet', async () => {
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      await expect(deobfuscatePacket(null as unknown as ObfuscatedPacket, testPasswords.valid)).rejects.toThrow(
        'Cannot deobfuscate an invalid packet'
      )
    })

    it('handles undefined packet', async () => {
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      await expect(deobfuscatePacket(undefined as unknown as ObfuscatedPacket, testPasswords.valid)).rejects.toThrow(
        'Cannot deobfuscate an invalid packet'
      )
    })

    it('handles non-Uint8Array packet', async () => {
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      await expect(deobfuscatePacket('not-a-uint8array' as unknown as ObfuscatedPacket, testPasswords.valid)).rejects.toThrow(
        'Cannot deobfuscate an invalid packet'
      )
    })

    it('handles empty Uint8Array', async () => {
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      await expect(deobfuscatePacket(new Uint8Array(0), testPasswords.valid)).rejects.toThrow('Cannot deobfuscate packet')
    })

    it('handles decryption failure', async () => {
      const failingDecrypt = async () => {
        throw new Error('Decryption failed')
      }
      const deobfuscatePacket = createPacketDeobfuscator(failingDecrypt)

      const validObfuscated = new Uint8Array([1, 2, 3, 4, 5])

      await expect(deobfuscatePacket(validObfuscated, testPasswords.valid)).rejects.toThrow('Cannot deobfuscate packet. Decryption failed')
    })

    it('handles invalid JSON after decryption', async () => {
      const mockDecrypt = async () => 'invalid-json-{['
      const deobfuscatePacket = createPacketDeobfuscator(mockDecrypt)

      const validObfuscated = new Uint8Array([1, 2, 3, 4, 5])

      await expect(deobfuscatePacket(validObfuscated, testPasswords.valid)).rejects.toThrow(
        'Cannot deobfuscate packet because cannot deserialize decrypted data'
      )
    })

    it('handles corrupted obfuscated data', async () => {
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const corruptedData = new Uint8Array([255, 255, 255, 255, 255])

      await expect(deobfuscatePacket(corruptedData, testPasswords.valid)).rejects.toThrow('Cannot deobfuscate packet')
    })
  })

  describe('frozen object validation', () => {
    it('returns frozen deobfuscated packet object', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const deobfuscatePacket = createPacketDeobfuscator(decrypt)

      const obfuscated = await obfuscatePacket(sampleSerializedEncryptedPacket, testPasswords.valid)
      const result = await deobfuscatePacket(obfuscated, testPasswords.valid)

      expect(Object.isFrozen(result)).toBe(true)
      expect(() => {
        ;(result as { origin: string }).origin = 'modified'
      }).toThrow()
    })
  })
})
