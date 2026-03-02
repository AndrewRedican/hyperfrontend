/**
 * Browser tests for packet encryption.
 * Node.js version: create-encrypter.spec.ts (identical except for imports)
 */

import type { UnencryptedPacket } from '../../model'
import { encrypt, createHash } from '@hyperfrontend/cryptography/browser'
import { createDataFactory } from '../../../data/creators/create-data-factory'
import { createDataEncrypter } from '../../../data/security/create-encrypter'
import { createPacketEncrypter } from './create-encrypter'
import { invalidPacketEncryptionTestCases, testPasswords, testUUIDs, testPIDs, testMessages } from './test-fixtures'

describe('createPacketEncrypter (Browser)', () => {
  let createData: ReturnType<typeof createDataFactory>

  beforeAll(() => {
    createData = createDataFactory(createHash)
  })

  describe('valid encryption', () => {
    it('encrypts standard packet with valid password', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }

      const result = await encryptPacket(packet, testPasswords.valid)

      expect(result.origin).toBe(packet.origin)
      expect(result.target).toBe(packet.target)
      expect(result.data).toBeInstanceOf(Uint8Array)
      expect(result.data.length).toBeGreaterThan(0)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('encrypts packet with alternative password', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid2, 2, testMessages.nested)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target2,
        data,
      }

      const result = await encryptPacket(packet, testPasswords.alternative)

      expect(result.origin).toBe(packet.origin)
      expect(result.target).toBe(packet.target)
      expect(result.data).toBeInstanceOf(Uint8Array)
      expect(result.data.length).toBeGreaterThan(0)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('encrypts packet with minimal data', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid1, 3, testMessages.minimal)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target2,
        data,
      }

      const result = await encryptPacket(packet, testPasswords.valid)

      expect(result.origin).toBe(packet.origin)
      expect(result.target).toBe(packet.target)
      expect(result.data).toBeInstanceOf(Uint8Array)
      expect(result.data.length).toBeGreaterThan(0)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('produces different outputs for different passwords', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }

      const result1 = await encryptPacket(packet, 'password1')
      const result2 = await encryptPacket(packet, 'password2')

      expect(result1.data).toBeInstanceOf(Uint8Array)
      expect(result2.data).toBeInstanceOf(Uint8Array)
      expect(result1.data).not.toEqual(result2.data)
    })

    it('produces different outputs for same packet due to encryption randomness', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }
      const password = 'same-password'

      const result1 = await encryptPacket(packet, password)
      const result2 = await encryptPacket(packet, password)

      expect(result1.data).toBeInstanceOf(Uint8Array)
      expect(result2.data).toBeInstanceOf(Uint8Array)
      expect(result1.data).not.toEqual(result2.data)
    })

    it('preserves origin and target fields', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid2, 1, { value: 123 })
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target2,
        data,
      }

      const result = await encryptPacket(packet, testPasswords.valid)

      expect(result.origin).toBe(testUUIDs.origin2)
      expect(result.target).toBe(testUUIDs.target2)
    })
  })

  describe('error handling', () => {
    invalidPacketEncryptionTestCases.forEach(({ description, packet, password }) => {
      it(`handles ${description}`, async () => {
        const encryptData = createDataEncrypter(encrypt)
        const encryptPacket = createPacketEncrypter(encryptData)

        await expect(encryptPacket(<UnencryptedPacket>(<unknown>packet), password)).rejects.toThrow('Cannot encrypt invalid packet')
      })
    })

    it('handles data encryption failure', async () => {
      const failingEncryptData = async () => {
        throw new Error('Encryption failed')
      }
      const encryptPacket = createPacketEncrypter(failingEncryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }

      await expect(encryptPacket(packet, testPasswords.valid)).rejects.toThrow('Cannot encrypt packet. Encryption failed')
    })

    it('handles packet with invalid origin UUID', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet = <UnencryptedPacket>{
        origin: 'invalid-uuid',
        target: testUUIDs.target1,
        data,
      }

      await expect(encryptPacket(packet, testPasswords.valid)).rejects.toThrow('Cannot encrypt invalid packet')
    })

    it('handles packet with invalid target UUID', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet = <UnencryptedPacket>{
        origin: testUUIDs.origin1,
        target: 'invalid-uuid',
        data,
      }

      await expect(encryptPacket(packet, testPasswords.valid)).rejects.toThrow('Cannot encrypt invalid packet')
    })
  })

  describe('frozen object validation', () => {
    it('returns frozen encrypted packet object', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const encryptPacket = createPacketEncrypter(encryptData)

      const data = await createData(testPIDs.pid1, 1, testMessages.simple)
      const packet: UnencryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data,
      }

      const result = await encryptPacket(packet, testPasswords.valid)

      expect(Object.isFrozen(result)).toBe(true)
      expect(() => {
        ;(<{ origin: string }>result).origin = 'modified'
      }).toThrow()
    })
  })
})
