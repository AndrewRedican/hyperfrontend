import type { SerializedEncryptedPacket } from '../../model'
import { encrypt } from '@hyperfrontend/cryptography/browser'
import { createPacketObfuscator } from './create-obfuscator'
import {
  invalidPacketObfuscationTestCases,
  testPasswords,
  testUUIDs,
  sampleSerializedEncryptedPacket,
  alternativeSerializedEncryptedPacket,
} from './test-fixtures'

describe('createPacketObfuscator (Browser)', () => {
  describe('valid obfuscation', () => {
    it('obfuscates standard packet with valid password', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)

      const result = await obfuscatePacket(sampleSerializedEncryptedPacket, testPasswords.valid)

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('obfuscates packet with alternative password', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)

      const result = await obfuscatePacket(alternativeSerializedEncryptedPacket, testPasswords.alternative)

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('obfuscates packet with minimal data', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)

      const minimalPacket: SerializedEncryptedPacket = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target2,
        data: 'x',
      }

      const result = await obfuscatePacket(minimalPacket, testPasswords.valid)

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('obfuscates packet with long data', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)

      const longDataPacket: SerializedEncryptedPacket = {
        origin: testUUIDs.origin2,
        target: testUUIDs.target1,
        data: 'a'.repeat(1000),
      }

      const result = await obfuscatePacket(longDataPacket, testPasswords.valid)

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('produces different outputs for different passwords', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)

      const result1 = await obfuscatePacket(sampleSerializedEncryptedPacket, 'password1')
      const result2 = await obfuscatePacket(sampleSerializedEncryptedPacket, 'password2')

      expect(result1).toBeInstanceOf(Uint8Array)
      expect(result2).toBeInstanceOf(Uint8Array)
      expect(result1).not.toEqual(result2)
    })

    it('produces different outputs for same packet due to encryption randomness', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const password = 'same-password'

      const result1 = await obfuscatePacket(sampleSerializedEncryptedPacket, password)
      const result2 = await obfuscatePacket(sampleSerializedEncryptedPacket, password)

      expect(result1).toBeInstanceOf(Uint8Array)
      expect(result2).toBeInstanceOf(Uint8Array)
      expect(result1).not.toEqual(result2)
    })

    it('produces different outputs for different packets', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)
      const password = testPasswords.valid

      const result1 = await obfuscatePacket(sampleSerializedEncryptedPacket, password)
      const result2 = await obfuscatePacket(alternativeSerializedEncryptedPacket, password)

      expect(result1).toBeInstanceOf(Uint8Array)
      expect(result2).toBeInstanceOf(Uint8Array)
      expect(result1).not.toEqual(result2)
    })
  })

  describe('error handling', () => {
    invalidPacketObfuscationTestCases.forEach(({ description, packet, password }) => {
      it(`handles ${description}`, async () => {
        const obfuscatePacket = createPacketObfuscator(encrypt)

        await expect(obfuscatePacket(packet as unknown as SerializedEncryptedPacket, password)).rejects.toThrow(
          'Cannot obfuscate an invalid packet'
        )
      })
    })

    it('handles encryption failure', async () => {
      const failingEncrypt = async () => {
        throw new Error('Encryption failed')
      }
      const obfuscatePacket = createPacketObfuscator(failingEncrypt)

      await expect(obfuscatePacket(sampleSerializedEncryptedPacket, testPasswords.valid)).rejects.toThrow(
        'Cannot obfuscate packet. Encryption failed'
      )
    })

    it('handles packet with invalid origin UUID', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)

      const packet = {
        origin: 'invalid-uuid',
        target: testUUIDs.target1,
        data: 'encrypted-data',
      } as SerializedEncryptedPacket

      await expect(obfuscatePacket(packet, testPasswords.valid)).rejects.toThrow('Cannot obfuscate an invalid packet')
    })

    it('handles packet with invalid target UUID', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)

      const packet = {
        origin: testUUIDs.origin1,
        target: 'invalid-uuid',
        data: 'encrypted-data',
      } as SerializedEncryptedPacket

      await expect(obfuscatePacket(packet, testPasswords.valid)).rejects.toThrow('Cannot obfuscate an invalid packet')
    })

    it('handles non-serializable packet', async () => {
      const obfuscatePacket = createPacketObfuscator(encrypt)

      const circularRef: { origin: string; target: string; data: string; self?: unknown } = {
        origin: testUUIDs.origin1,
        target: testUUIDs.target1,
        data: 'test',
      }
      circularRef.self = circularRef

      await expect(obfuscatePacket(circularRef as SerializedEncryptedPacket, testPasswords.valid)).rejects.toThrow(
        'Cannot obfuscate packet because it is not serializable'
      )
    })
  })
})
