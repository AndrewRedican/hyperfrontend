import type { SerializedData } from '../model'
import { encrypt } from '@hyperfrontend/cryptography/browser'
import { createDataEncrypter } from './create-encrypter'
import { encryptionTestCases, invalidEncryptionTestCases } from './test-fixtures'

describe('createDataEncrypter (Browser)', () => {
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
      const data = <SerializedData>{ message: JSON.stringify('test') }
      const result1 = await encryptData(data, 'password1')
      const result2 = await encryptData(data, 'password2')

      expect(result1).toBeInstanceOf(Uint8Array)
      expect(result2).toBeInstanceOf(Uint8Array)
      expect(result1).not.toEqual(result2)
    })

    it('produces different outputs for same data due to encryption randomness', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const data = <SerializedData>{ message: JSON.stringify('test') }
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

        await expect(encryptData(<SerializedData>(<unknown>data), password)).rejects.toThrow()
      })
    })

    it('handles unserializable data (circular references)', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const circular: { self?: unknown } = {}
      circular.self = circular

      await expect(encryptData(<SerializedData>(<unknown>circular), 'valid-password')).rejects.toThrow()
    })
  })
})
