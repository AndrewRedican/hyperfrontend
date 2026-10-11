import { afterEach } from 'node:test'
import { defineProperty, getOwnPropertyDescriptor } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { symbolToStringTag } from '@hyperfrontend/immutable-api-utils/built-in-copy/symbol'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { describe, expect, it } from '@hyperfrontend/testing'
import { subtle } from './browser'

describe('subtle (browser)', () => {
  it('delegates method calls to the live globalThis.crypto.subtle', async () => {
    const digest = await subtle.digest('SHA-256', createUint8Array([1, 2, 3]))
    expect(digest.byteLength).toBe(32)
  })

  it('passes non-function members through unchanged', () => {
    expect((subtle as unknown as Record<symbol, unknown>)[symbolToStringTag]).toBe('SubtleCrypto')
  })

  describe('without a crypto global', () => {
    const original = getOwnPropertyDescriptor(globalThis, 'crypto')

    afterEach(() => {
      defineProperty(globalThis, 'crypto', original ?? { value: undefined, configurable: true, writable: true })
    })

    it('throws a descriptive error at first use instead of at import', () => {
      defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true })
      expect(() => subtle.digest).toThrow('Web Crypto is unavailable')
    })
  })
})
