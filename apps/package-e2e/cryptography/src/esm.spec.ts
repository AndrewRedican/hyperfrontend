/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/cryptography`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/cryptography ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the node entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/cryptography/node')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        createHash: 'function',
        encrypt: 'function',
        decrypt: 'function',
        createVault: 'function',
        generateKey: 'function',
        getRandomValues: 'function',
        getTimeBasedPassword: 'function',
        isSHA256Hash: 'function',
      })
    )
  })

  it('exposes the documented surface of the common entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/cryptography/common')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        isSHA256Hash: 'function',
      })
    )
  })

  it('hashes a message with SHA-256 through the node entry', () => {
    const hash = consumer.run(async () => {
      const { createHash } = await import('@hyperfrontend/cryptography/node')
      return await createHash('abc')
    })
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('accepts a well-formed SHA-256 hash through the common entry', () => {
    const accepted = consumer.run(async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/common')
      return isSHA256Hash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })
    expect(accepted).toBe(true)
  })

  it('rejects a string that is not a SHA-256 hash', () => {
    const accepted = consumer.run(async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/common')
      return isSHA256Hash('not-a-hash')
    })
    expect(accepted).toBe(false)
  })

  it('decrypts what it encrypted under the same password', () => {
    const opened = consumer.run(async () => {
      const { decrypt, encrypt } = await import('@hyperfrontend/cryptography/node')
      const sealed = await encrypt('top secret', 'pa55word')
      return await decrypt(sealed, 'pa55word')
    })
    expect(opened).toBe('top secret')
  })

  it('keeps the plaintext out of the sealed bytes', () => {
    const leaked = consumer.run(async () => {
      const { encrypt } = await import('@hyperfrontend/cryptography/node')
      const sealed = await encrypt('top secret', 'pa55word')
      return new TextDecoder().decode(sealed).includes('top secret')
    })
    expect(leaked).toBe(false)
  })

  it('refuses to decrypt under another password', () => {
    const outcome = consumer.run(async () => {
      const { decrypt, encrypt } = await import('@hyperfrontend/cryptography/node')
      const sealed = await encrypt('top secret', 'pa55word')
      try {
        await decrypt(sealed, 'other-pass')
        return 'opened'
      } catch {
        return 'rejected'
      }
    })
    expect(outcome).toBe('rejected')
  })
})
