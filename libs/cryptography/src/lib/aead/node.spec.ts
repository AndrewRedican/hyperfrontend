import { before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { expandKey } from '../expand-key/node'
import { getRandomValues } from '../get-random-values/node'
import { isAeadKey } from './guards'
import { open, seal } from './node'

describe('seal and open (node)', () => {
  const nonce = new Uint8Array(12)
  const header = new Uint8Array([4, 0, 0, 0, 0, 0, 0, 0, 1])
  const plaintext = new Uint8Array([104, 101, 108, 108, 111])
  let encryptKey: CryptoKey
  let decryptKey: CryptoKey

  beforeAll(async () => {
    const ikm = getRandomValues(32)
    const salt = getRandomValues(64)
    encryptKey = await expandKey(ikm, salt, new Uint8Array([1]), ['encrypt'])
    decryptKey = await expandKey(ikm, salt, new Uint8Array([1]), ['decrypt'])
  })

  it('round-trips a plaintext through seal and open', async () => {
    await expect(open(decryptKey, nonce, header, await seal(encryptKey, nonce, header, plaintext))).resolves.toEqual(plaintext)
  })

  it('appends a 16-byte tag to the ciphertext', async () => {
    await expect(seal(encryptKey, nonce, header, plaintext)).resolves.toHaveLength(plaintext.length + 16)
  })

  it('rejects a message whose additional data changed', async () => {
    const sealed = await seal(encryptKey, nonce, header, plaintext)
    await expect(open(decryptKey, nonce, new Uint8Array(9), sealed)).rejects.toThrow('Cannot open the message: authentication failed')
  })

  it('rejects a message whose ciphertext changed', async () => {
    const sealed = await seal(encryptKey, nonce, header, plaintext)
    sealed[0] ^= 1
    await expect(open(decryptKey, nonce, header, sealed)).rejects.toThrow('Cannot open the message: authentication failed')
  })

  it('rejects a message opened under a different nonce', async () => {
    const sealed = await seal(encryptKey, nonce, header, plaintext)
    await expect(open(decryptKey, new Uint8Array([...nonce.slice(0, 11), 1]), header, sealed)).rejects.toThrow(
      'Cannot open the message: authentication failed'
    )
  })

  it('refuses to seal with a key that may only decrypt', async () => {
    await expect(seal(decryptKey, nonce, header, plaintext)).rejects.toThrow()
  })

  it('rejects sealing without an AES-GCM key', async () => {
    await expect(seal({} as CryptoKey, nonce, header, plaintext)).rejects.toThrow('Cannot seal without an AES-GCM key')
  })

  it('rejects sealing with a nonce of the wrong length', async () => {
    await expect(seal(encryptKey, new Uint8Array(16), header, plaintext)).rejects.toThrow('Cannot seal without a 12-byte nonce')
  })

  it('rejects sealing with additional data that is not a byte array', async () => {
    await expect(seal(encryptKey, nonce, 'aad' as unknown as Uint8Array, plaintext)).rejects.toThrow(
      'Cannot seal without additional data as a byte array'
    )
  })

  it('rejects sealing an empty plaintext', async () => {
    await expect(seal(encryptKey, nonce, header, new Uint8Array())).rejects.toThrow('Cannot seal an empty plaintext')
  })

  it('rejects opening without an AES-GCM key', async () => {
    await expect(open(null as unknown as CryptoKey, nonce, header, new Uint8Array(20))).rejects.toThrow(
      'Cannot open without an AES-GCM key'
    )
  })

  it('rejects opening with a nonce of the wrong length', async () => {
    await expect(open(decryptKey, new Uint8Array(8), header, new Uint8Array(20))).rejects.toThrow('Cannot open without a 12-byte nonce')
  })

  it('rejects opening with additional data that is not a byte array', async () => {
    await expect(open(decryptKey, nonce, 'aad' as unknown as Uint8Array, new Uint8Array(20))).rejects.toThrow(
      'Cannot open without additional data as a byte array'
    )
  })

  it('rejects opening a message no longer than the tag', async () => {
    await expect(open(decryptKey, nonce, header, new Uint8Array(16))).rejects.toThrow(
      'Cannot open a message shorter than its authentication tag'
    )
  })

  it('recognises an AES-GCM key', () => {
    expect(isAeadKey(encryptKey)).toBe(true)
  })

  it('does not recognise a plain object as an AES-GCM key', () => {
    expect(isAeadKey({ algorithm: { name: 'HKDF' } })).toBe(false)
  })
})
