/** @jest-environment node */
import { encrypt } from '../encrypt/node'
import { decrypt } from './node'

describe('decrypt (node)', () => {
  const message = 'Test Message'
  const password = 'TestPassword'

  it('decrypts a message successfully', async () => {
    const encrypted = await encrypt(message, password)
    const decrypted = await decrypt(encrypted, password)
    expect(decrypted).toBe(message)
  })

  it('throws an error when encrypted message is empty', async () => {
    const emptyUintArray = new Uint8Array(0)
    await expect(decrypt(emptyUintArray, password)).rejects.toThrow('Cannot decrypt without a message')
  })

  it('throws an error when password is empty', async () => {
    const encrypted = await encrypt(message, password)
    await expect(decrypt(encrypted, '')).rejects.toThrow('Cannot decrypt without a password')
  })
})
