/**
 * Browser tests for packet decryption.
 * Node.js version: create-decrypter.spec.ts (identical except for imports)
 */

import type { UnencryptedPacket } from '../../model'
import { encrypt, decrypt, createHash } from '@hyperfrontend/cryptography/browser'
import { createDataFactory } from '../../../data/creators'
import { createDataEncrypter, createDataDecrypter } from '../../../data/security'
import { createPacketEncrypter } from './create-encrypter'
import { createPacketDecrypter } from './create-decrypter'
import { testPasswords, testUUIDs, testPIDs, testMessages, sampleUnserializedEncryptedPacket } from './test-fixtures'

describe('createPacketDecrypter (Browser)', () => {
  let createData: ReturnType<typeof createDataFactory>

  beforeAll(() => {
    createData = createDataFactory(createHash)
  })

  describe('round-trip encryption/decryption', () => {
    it('decrypts standard packet with valid password', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }

      const encrypted = await encryptPacket(packet, testPasswords.valid)
      const decrypted = await decryptPacket(encrypted, testPasswords.valid)

      expect(decrypted.origin).toBe(packet.origin)
      expect(decrypted.target).toBe(packet.target)
      expect(decrypted.data).toEqual(packet.data)
      expect(Object.isFrozen(decrypted)).toBe(true)
    })

    it('decrypts packet with alternative password', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)

      const data = await createData(testPIDs.pid2, 2, testMessages.nested)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target2,
        data,
      }

      const encrypted = await encryptPacket(packet, testPasswords.alternative)
      const decrypted = await decryptPacket(encrypted, testPasswords.alternative)

      expect(decrypted.origin).toBe(packet.origin)
      expect(decrypted.target).toBe(packet.target)
      expect(decrypted.data).toEqual(packet.data)
      expect(Object.isFrozen(decrypted)).toBe(true)
    })

    it('decrypts packet with minimal data', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)

      const data = await createData(testPIDs.pid1, 3, testMessages.minimal)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target2,
        data,
      }

      const encrypted = await encryptPacket(packet, testPasswords.valid)
      const decrypted = await decryptPacket(encrypted, testPasswords.valid)

      expect(decrypted.origin).toBe(packet.origin)
      expect(decrypted.target).toBe(packet.target)
      expect(decrypted.data).toEqual(packet.data)
      expect(Object.isFrozen(decrypted)).toBe(true)
    })

    it('maintains data integrity through multiple encryptions', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.complex)
      const originalPacket: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }
      const password = 'test-password'

      let encrypted = await encryptPacket(originalPacket, password)
      let decrypted = await decryptPacket(encrypted, password)
      expect(decrypted.data).toEqual(originalPacket.data)

      encrypted = await encryptPacket(decrypted, password)
      decrypted = await decryptPacket(encrypted, password)
      expect(decrypted.data).toEqual(originalPacket.data)
    })

    it('preserves origin and target fields through encryption cycle', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)

      const data = await createData(testPIDs.pid2, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target2,
        data,
      }

      const encrypted = await encryptPacket(packet, testPasswords.valid)
      const decrypted = await decryptPacket(encrypted, testPasswords.valid)

      expect(decrypted.origin).toBe(testUUIDs.origin2)
      expect(decrypted.target).toBe(testUUIDs.target2)
    })
  })

  describe('error handling', () => {
    it('handles invalid encrypted packet (null)', async () => {
      const decryptData = createDataDecrypter(decrypt)
      const decryptPacket = createPacketDecrypter(decryptData)

      await expect(decryptPacket(<any>null, testPasswords.valid)).rejects.toThrow('Cannot decrypt invalid packet')
    })

    it('handles invalid encrypted packet (undefined)', async () => {
      const decryptData = createDataDecrypter(decrypt)
      const decryptPacket = createPacketDecrypter(decryptData)

      await expect(decryptPacket(<any>undefined, testPasswords.valid)).rejects.toThrow('Cannot decrypt invalid packet')
    })

    it('handles packet missing data field', async () => {
      const decryptData = createDataDecrypter(decrypt)
      const decryptPacket = createPacketDecrypter(decryptData)

      const invalidPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
      }

      await expect(decryptPacket(<any>invalidPacket, testPasswords.valid)).rejects.toThrow('Cannot decrypt invalid packet')
    })

    it('handles packet with invalid origin UUID', async () => {
      const decryptData = createDataDecrypter(decrypt)
      const decryptPacket = createPacketDecrypter(decryptData)

      const invalidPacket = {
        origin: 'invalid-uuid',
        target: testUUIDs.target1,
        data: new Uint8Array([1, 2, 3]),
      }

      await expect(decryptPacket(<any>invalidPacket, testPasswords.valid)).rejects.toThrow('Cannot decrypt invalid packet')
    })

    it('handles packet with invalid target UUID', async () => {
      const decryptData = createDataDecrypter(decrypt)
      const decryptPacket = createPacketDecrypter(decryptData)

      const invalidPacket = {
        origin: testUUIDs.origin1,
        target: 'invalid-uuid',
        data: new Uint8Array([1, 2, 3]),
      }

      await expect(decryptPacket(<any>invalidPacket, testPasswords.valid)).rejects.toThrow('Cannot decrypt invalid packet')
    })

    it('handles wrong password', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }
      const encrypted = await encryptPacket(packet, 'correct-password')

      await expect(decryptPacket(encrypted, 'wrong-password')).rejects.toThrow('Cannot decrypt packet')
    })

    it('handles corrupted encrypted data', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }
      const encrypted = await encryptPacket(packet, 'password')

      const corrupted = { ...encrypted, data: new Uint8Array(encrypted.data) }
      corrupted.data[0] = corrupted.data[0] ^ 0xff

      await expect(decryptPacket(corrupted, 'password')).rejects.toThrow('Cannot decrypt packet')
    })

    it('handles data decryption failure', async () => {
      const failingDecryptData = async () => {
        throw new Error('Decryption failed')
      }
      const decryptPacket = createPacketDecrypter(failingDecryptData)

      await expect(decryptPacket(sampleUnserializedEncryptedPacket, testPasswords.valid)).rejects.toThrow(
        'Cannot decrypt packet. Decryption failed'
      )
    })

    it('handles empty password', async () => {
      const decryptData = createDataDecrypter(decrypt)
      const decryptPacket = createPacketDecrypter(decryptData)

      await expect(decryptPacket(sampleUnserializedEncryptedPacket, '')).rejects.toThrow('Cannot decrypt packet')
    })
  })

  describe('frozen object validation', () => {
    it('returns frozen decrypted packet object', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)
      const encryptPacket = createPacketEncrypter(encryptData)
      const decryptPacket = createPacketDecrypter(decryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }

      const encrypted = await encryptPacket(packet, testPasswords.valid)
      const result = await decryptPacket(encrypted, testPasswords.valid)

      expect(Object.isFrozen(result)).toBe(true)
      expect(() => {
        ;(result as { origin: string }).origin = 'modified'
      }).toThrow()
    })
  })
})
