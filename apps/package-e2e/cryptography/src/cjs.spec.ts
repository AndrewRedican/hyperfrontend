/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/cryptography`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/cryptography CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the node entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/cryptography/node')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
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
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/cryptography/common')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        isSHA256Hash: 'function',
      })
    )
  })

  it('hashes a message with SHA-256 through the node entry', () => {
    const hash = consumer.run(
      async () => {
        const { createHash } = require('@hyperfrontend/cryptography/node')
        return await createHash('abc')
      },
      { kind: 'require' }
    )
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('accepts a well-formed SHA-256 hash through the common entry', () => {
    const accepted = consumer.run(
      async () => {
        const { isSHA256Hash } = require('@hyperfrontend/cryptography/common')
        return isSHA256Hash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
      },
      { kind: 'require' }
    )
    expect(accepted).toBe(true)
  })

  it('rejects a string that is not a SHA-256 hash', () => {
    const accepted = consumer.run(
      async () => {
        const { isSHA256Hash } = require('@hyperfrontend/cryptography/common')
        return isSHA256Hash('not-a-hash')
      },
      { kind: 'require' }
    )
    expect(accepted).toBe(false)
  })

  it('decrypts what it encrypted under the same password', () => {
    const opened = consumer.run(
      async () => {
        const { decrypt, encrypt } = require('@hyperfrontend/cryptography/node')
        const sealed = await encrypt('top secret', 'pa55word')
        return await decrypt(sealed, 'pa55word')
      },
      { kind: 'require' }
    )
    expect(opened).toBe('top secret')
  })

  it('keeps the plaintext out of the sealed bytes', () => {
    const leaked = consumer.run(
      async () => {
        const { encrypt } = require('@hyperfrontend/cryptography/node')
        const sealed = await encrypt('top secret', 'pa55word')
        return new TextDecoder().decode(sealed).includes('top secret')
      },
      { kind: 'require' }
    )
    expect(leaked).toBe(false)
  })

  it('refuses to decrypt under another password', () => {
    const outcome = consumer.run(
      async () => {
        const { decrypt, encrypt } = require('@hyperfrontend/cryptography/node')
        const sealed = await encrypt('top secret', 'pa55word')
        try {
          await decrypt(sealed, 'other-pass')
          return 'opened'
        } catch {
          return 'rejected'
        }
      },
      { kind: 'require' }
    )
    expect(outcome).toBe('rejected')
  })
})
