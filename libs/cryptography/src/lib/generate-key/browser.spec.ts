/** @jest-environment jsdom */
import { getRandomValues } from '../get-random-values/browser'
import { generateKey } from './browser'
import { encryptionConfig } from '../encryption-config'

describe('generateKey (browser)', () => {
  it('creates a key', async () => {
    const key = await generateKey('test-password', getRandomValues(4))
    expect(key).toEqual(
      expect.objectContaining({
        algorithm: expect.objectContaining({
          name: encryptionConfig.name,
          length: 256,
        }),
        extractable: false,
        type: 'secret',
        usages: ['encrypt', 'decrypt'],
      })
    )
  })

  it('throws an error when password is empty', async () => {
    await expect(generateKey(<string>(<unknown>null), getRandomValues(4))).rejects.toThrow(
      'Cannot generate key without a password type string'
    )
    await expect(generateKey('', getRandomValues(4))).rejects.toThrow('Cannot generate key with an empty string as password')
  })

  it('throws an error when salt is missing', async () => {
    await expect(generateKey('test-password', <Uint8Array>(<unknown>null))).rejects.toThrow('Cannot generate key without a salt')
  })
})
