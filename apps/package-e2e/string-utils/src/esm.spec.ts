/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/string-utils
 * Tests that the package sub-entries are importable and exports work correctly.
 *
 * Note: string-utils has platform-specific entries: ./browser, ./node
 */

describe('@hyperfrontend/string-utils ESM', () => {
  describe('node sub-entry', () => {
    it('is importable', async () => {
      const nodeEntry = await import('@hyperfrontend/string-utils/node')
      expect(nodeEntry).toBeDefined()
    })

    it('exports utf8StringToUint8Array function', async () => {
      const { utf8StringToUint8Array } = await import('@hyperfrontend/string-utils/node')
      expect(typeof utf8StringToUint8Array).toBe('function')
    })

    it('exports uint8ArrayToUtf8String function', async () => {
      const { uint8ArrayToUtf8String } = await import('@hyperfrontend/string-utils/node')
      expect(typeof uint8ArrayToUtf8String).toBe('function')
    })

    it('exports uint8ArrayToBase64 function', async () => {
      const { uint8ArrayToBase64 } = await import('@hyperfrontend/string-utils/node')
      expect(typeof uint8ArrayToBase64).toBe('function')
    })

    it('exports base64ToUint8Array function', async () => {
      const { base64ToUint8Array } = await import('@hyperfrontend/string-utils/node')
      expect(typeof base64ToUint8Array).toBe('function')
    })

    it('exports arrayBufferToUtf8String function', async () => {
      const { arrayBufferToUtf8String } = await import('@hyperfrontend/string-utils/node')
      expect(typeof arrayBufferToUtf8String).toBe('function')
    })

    it('exports toBase64 function', async () => {
      const { toBase64 } = await import('@hyperfrontend/string-utils/node')
      expect(typeof toBase64).toBe('function')
    })

    it('exports fromBase64 function', async () => {
      const { fromBase64 } = await import('@hyperfrontend/string-utils/node')
      expect(typeof fromBase64).toBe('function')
    })

    it('correctly converts string to Uint8Array and back', async () => {
      const { utf8StringToUint8Array, uint8ArrayToUtf8String } = await import('@hyperfrontend/string-utils/node')

      const original = 'Hello, World! 👋'
      const uint8Array = utf8StringToUint8Array(original)
      const result = uint8ArrayToUtf8String(uint8Array)

      expect(result).toBe(original)
    })

    it('correctly converts to base64 and back', async () => {
      const { toBase64, fromBase64 } = await import('@hyperfrontend/string-utils/node')

      const original = 'Hello, World!'
      const base64 = toBase64(original)
      const result = fromBase64(base64)

      expect(result).toBe(original)
    })
  })

  // Note: browser sub-entry is not tested in Node.js environment
})
