/** @jest-environment node */
import { describe, expect, it } from '@hyperfrontend/testing'
import { decrypt } from '../decrypt/node'
import { encrypt } from './node'

describe('encrypt (node)', () => {
  const message = 'message'
  const password = 'password'

  it('encrypts a message successfully', async () => {
    const result = await encrypt(message, password)
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('throws an error when message is empty', async () => {
    await expect(encrypt('', password)).rejects.toThrow('Cannot encrypt an empty message.')
  })

  it('throws an error when password is empty', async () => {
    await expect(encrypt(message, '')).rejects.toThrow('Cannot encrypt without a password.')
  })

  it('encrypted message can be decrypted', async () => {
    const encrypted = await encrypt(message, password)
    const decrypted = await decrypt(encrypted, password)
    expect(decrypted).toEqual(message)
  })
})
