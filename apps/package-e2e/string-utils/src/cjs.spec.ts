/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/string-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/string-utils CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the node entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/string-utils/node')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        utf8StringToUint8Array: 'function',
        uint8ArrayToUtf8String: 'function',
        uint8ArrayToBase64: 'function',
        base64ToUint8Array: 'function',
        arrayBufferToUtf8String: 'function',
        toBase64: 'function',
        fromBase64: 'function',
      })
    )
  })

  it('converts a string to bytes and back', () => {
    const text = consumer.run(
      async () => {
        const { uint8ArrayToUtf8String, utf8StringToUint8Array } = require('@hyperfrontend/string-utils/node')
        return uint8ArrayToUtf8String(utf8StringToUint8Array('Hello, World! 👋'))
      },
      { kind: 'require' }
    )
    expect(text).toBe('Hello, World! 👋')
  })

  it('encodes a string as base64', () => {
    const encoded = consumer.run(
      async () => {
        const { toBase64 } = require('@hyperfrontend/string-utils/node')
        return toBase64('Hello, World!')
      },
      { kind: 'require' }
    )
    expect(encoded).toBe('SGVsbG8sIFdvcmxkIQ==')
  })

  it('decodes what it encoded as base64', () => {
    const text = consumer.run(
      async () => {
        const { fromBase64, toBase64 } = require('@hyperfrontend/string-utils/node')
        return fromBase64(toBase64('Hello, World! 👋'))
      },
      { kind: 'require' }
    )
    expect(text).toBe('Hello, World! 👋')
  })

  it('round-trips bytes through base64', () => {
    const text = consumer.run(
      async () => {
        const {
          base64ToUint8Array,
          uint8ArrayToBase64,
          uint8ArrayToUtf8String,
          utf8StringToUint8Array,
        } = require('@hyperfrontend/string-utils/node')
        const bytes = utf8StringToUint8Array('Hello, World! 👋')
        return uint8ArrayToUtf8String(base64ToUint8Array(uint8ArrayToBase64(bytes)))
      },
      { kind: 'require' }
    )
    expect(text).toBe('Hello, World! 👋')
  })
})
