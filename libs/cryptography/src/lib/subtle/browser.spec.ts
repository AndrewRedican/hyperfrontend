import { afterEach } from 'node:test'
import { symbolToStringTag } from '@hyperfrontend/immutable-api-utils/built-in-copy/symbol'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('throws a descriptive error at first use instead of at import', () => {
      jest.stubGlobal('crypto', undefined)
      expect(() => subtle.digest).toThrow('Web Crypto is unavailable')
    })
  })
})
