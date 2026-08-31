/** @jest-environment node */
import { encryptionConfig } from '../encryption-config'
import { getRandomValues } from '../get-random-values/node'
import { generateKey } from './node'

describe('generateKey (node)', () => {
  it('creates a key', async () => {
    const salt = getRandomValues(4)
    const key = await generateKey('test-password', salt)
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
    await expect(generateKey(null as unknown as string, getRandomValues(4))).rejects.toThrow(
      'Cannot generate key without a password type string'
    )
    await expect(generateKey('', getRandomValues(4))).rejects.toThrow('Cannot generate key with an empty string as password')
  })

  it('throws an error when salt is missing', async () => {
    await expect(generateKey('test-password', null as unknown as Uint8Array)).rejects.toThrow('Cannot generate key without a salt')
  })
})
