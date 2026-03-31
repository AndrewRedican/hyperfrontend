import type { SerializedData } from '../model'
import { encrypt, decrypt } from '@hyperfrontend/cryptography/browser'
import { createDataDecrypter } from './create-decrypter'
import { createDataEncrypter } from './create-encrypter'
import { encryptionTestCases } from './test-fixtures'

describe('createDataDecrypter (Browser)', () => {
  describe('round-trip encryption/decryption', () => {
    encryptionTestCases.forEach(({ description, data, password }) => {
      it(`decrypts ${description}`, async () => {
        const encryptData = createDataEncrypter(encrypt)
        const decryptData = createDataDecrypter(decrypt)

        const encrypted = await encryptData(<SerializedData>data, password)
        const decrypted = await decryptData(encrypted, password)

        expect(decrypted).toEqual(<SerializedData>data)
      })
    })

    it('maintains data integrity through multiple encryptions', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)

      const originalData = <SerializedData>(<unknown>{
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
      })
      const password = 'test-password'

      let encrypted = await encryptData(originalData, password)
      let decrypted = await decryptData(encrypted, password)
      expect(decrypted).toEqual(originalData)

      encrypted = await encryptData(decrypted, password)
      decrypted = await decryptData(encrypted, password)
      expect(decrypted).toEqual(originalData)
    })
  })

  describe('error handling', () => {
    it('handles invalid encrypted data (null)', async () => {
      const decryptData = createDataDecrypter(decrypt)

      await expect(decryptData(<Uint8Array>null, 'valid-password')).rejects.toThrow()
    })

    it('handles invalid encrypted data (undefined)', async () => {
      const decryptData = createDataDecrypter(decrypt)

      await expect(decryptData(<Uint8Array>undefined, 'valid-password')).rejects.toThrow()
    })

    it('handles invalid encrypted data (not Uint8Array)', async () => {
      const decryptData = createDataDecrypter(decrypt)

      await expect(decryptData(<Uint8Array>(<unknown>'not-a-uint8array'), 'valid-password')).rejects.toThrow()
    })

    it('handles wrong password', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)

      const data = <SerializedData>{ message: JSON.stringify('secret') }
      const encrypted = await encryptData(data, 'correct-password')

      await expect(decryptData(encrypted, 'wrong-password')).rejects.toThrow()
    })

    it('handles corrupted encrypted data', async () => {
      const encryptData = createDataEncrypter(encrypt)
      const decryptData = createDataDecrypter(decrypt)

      const data = <SerializedData>{ message: JSON.stringify('test') }
      const encrypted = await encryptData(data, 'password')

      const corrupted = new Uint8Array(encrypted)
      corrupted[0] = corrupted[0] ^ 0xff

      await expect(decryptData(corrupted, 'password')).rejects.toThrow()
    })

    it('handles empty password', async () => {
      const decryptData = createDataDecrypter(decrypt)
      const fakeEncrypted = new Uint8Array([1, 2, 3])

      await expect(decryptData(fakeEncrypted, '')).rejects.toThrow()
    })
  })
})
