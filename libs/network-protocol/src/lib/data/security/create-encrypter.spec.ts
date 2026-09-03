import type { SerializedData } from '../model'
import { encrypt } from '@hyperfrontend/cryptography/node'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createDataEncrypter } from './create-encrypter'
import { encryptionTestCases, invalidEncryptionTestCases } from './test-fixtures'

describe('createDataEncrypter (Node.js)', () => {
  describe('valid encryption', () => {
    encryptionTestCases.forEach(({ description, data, password }) => {
      it(`encrypts ${description}`, async () => {
        const encryptData = createDataEncrypter(encrypt)
        const result = await encryptData(data, password)

        expect(result).toBeInstanceOf(Uint8Array)
        expect(result.length).toBeGreaterThan(0)
      })
    })

    it('produces different outputs for different passwords', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const data = { message: JSON.stringify('test') } as SerializedData

      const result1 = await encryptData(data, 'password1')
      const result2 = await encryptData(data, 'password2')

      expect(result1).toBeInstanceOf(Uint8Array)
      expect(result2).toBeInstanceOf(Uint8Array)
      expect(result1).not.toEqual(result2)
    })

    it('produces different outputs for same data due to encryption randomness', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const data = { message: JSON.stringify('test') } as SerializedData
      const password = 'same-password'

      const result1 = await encryptData(data, password)
      const result2 = await encryptData(data, password)

      expect(result1).toBeInstanceOf(Uint8Array)
      expect(result2).toBeInstanceOf(Uint8Array)
      expect(result1).not.toEqual(result2)
    })
  })

  describe('error handling', () => {
    invalidEncryptionTestCases.forEach(({ description, data, password }) => {
      it(`handles ${description}`, async () => {
        const encryptData = createDataEncrypter(encrypt)

        await expect(encryptData(data as unknown as SerializedData, password)).rejects.toThrow()
      })
    })

    it('handles unserializable data (circular references)', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const circular: { self?: unknown } = {}
      circular.self = circular

      await expect(encryptData(circular as unknown as SerializedData, 'valid-password')).rejects.toThrow()
    })

    it('handles encryption function failure', async () => {
      const mockEncrypt = jest.fn().mockRejectedValue(new Error('Encryption failed'))
      const encryptData = createDataEncrypter(mockEncrypt)

      const data = { message: JSON.stringify('test') } as SerializedData

      await expect(encryptData(data, 'password')).rejects.toThrow('Cannot encrypt data')
    })
  })
})
