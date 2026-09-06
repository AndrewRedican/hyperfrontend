import { describe, expect, it } from '@hyperfrontend/testing'
import { getRandomValues } from '../get-random-values/node'
import { expandKey } from './node'

describe('expandKey (node)', () => {
  const ikm = getRandomValues(32)
  const salt = getRandomValues(64)
  const info = new Uint8Array([1, 2, 3])

  it('derives a non-extractable AES-GCM key limited to the requested usages', async () => {
    await expect(expandKey(ikm, salt, info, ['encrypt'])).resolves.toEqual(
      expect.objectContaining({
        algorithm: expect.objectContaining({ name: 'AES-GCM', length: 256 }),
        extractable: false,
        usages: ['encrypt'],
      })
    )
  })

  it('accepts both usages at once', async () => {
    await expect(expandKey(ikm, salt, info, ['encrypt', 'decrypt'])).resolves.toEqual(
      expect.objectContaining({ usages: ['encrypt', 'decrypt'] })
    )
  })

  it('accepts an empty salt', async () => {
    await expect(expandKey(ikm, new Uint8Array(), info, ['decrypt'])).resolves.toEqual(expect.objectContaining({ usages: ['decrypt'] }))
  })

  it('rejects empty input key material', async () => {
    await expect(expandKey(new Uint8Array(), salt, info, ['encrypt'])).rejects.toThrow('Cannot expand a key without input key material')
  })

  it('rejects a salt that is not a byte array', async () => {
    await expect(expandKey(ikm, 'salt' as unknown as Uint8Array, info, ['encrypt'])).rejects.toThrow('Cannot expand a key without a salt')
  })

  it('rejects info that is not a byte array', async () => {
    await expect(expandKey(ikm, salt, 'info' as unknown as Uint8Array, ['encrypt'])).rejects.toThrow(
      'Cannot expand a key without context info'
    )
  })

  it('rejects a usage outside encrypt and decrypt', async () => {
    await expect(expandKey(ikm, salt, info, ['sign' as KeyUsage])).rejects.toThrow(
      "Key usages must be a non-empty list drawn from 'encrypt' and 'decrypt'"
    )
  })

  it('rejects an empty usage list', async () => {
    await expect(expandKey(ikm, salt, info, [])).rejects.toThrow("Key usages must be a non-empty list drawn from 'encrypt' and 'decrypt'")
  })
})
