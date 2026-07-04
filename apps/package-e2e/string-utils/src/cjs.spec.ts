/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/string-utils
 * Tests that the package sub-entries are requireable and exports work correctly.
 *
 * Note: string-utils has platform-specific entries: ./browser, ./node
 */

describe('@hyperfrontend/string-utils CJS', () => {
  describe('node sub-entry', () => {
    it('should be requireable', () => {
      const nodeEntry = require('@hyperfrontend/string-utils/node')
      expect(nodeEntry).toBeDefined()
    })

    it('should export utf8StringToUint8Array function', () => {
      const { utf8StringToUint8Array } = require('@hyperfrontend/string-utils/node')
      expect(typeof utf8StringToUint8Array).toBe('function')
    })

    it('should export uint8ArrayToUtf8String function', () => {
      const { uint8ArrayToUtf8String } = require('@hyperfrontend/string-utils/node')
      expect(typeof uint8ArrayToUtf8String).toBe('function')
    })

    it('should export uint8ArrayToBase64 function', () => {
      const { uint8ArrayToBase64 } = require('@hyperfrontend/string-utils/node')
      expect(typeof uint8ArrayToBase64).toBe('function')
    })

    it('should export base64ToUint8Array function', () => {
      const { base64ToUint8Array } = require('@hyperfrontend/string-utils/node')
      expect(typeof base64ToUint8Array).toBe('function')
    })

    it('should export arrayBufferToUtf8String function', () => {
      const { arrayBufferToUtf8String } = require('@hyperfrontend/string-utils/node')
      expect(typeof arrayBufferToUtf8String).toBe('function')
    })

    it('should export toBase64 function', () => {
      const { toBase64 } = require('@hyperfrontend/string-utils/node')
      expect(typeof toBase64).toBe('function')
    })

    it('should export fromBase64 function', () => {
      const { fromBase64 } = require('@hyperfrontend/string-utils/node')
      expect(typeof fromBase64).toBe('function')
    })

    it('should correctly convert string to Uint8Array and back', () => {
      const { utf8StringToUint8Array, uint8ArrayToUtf8String } = require('@hyperfrontend/string-utils/node')

      const original = 'Hello, World! 👋'
      const uint8Array = utf8StringToUint8Array(original)
      const result = uint8ArrayToUtf8String(uint8Array)

      expect(result).toBe(original)
    })

    it('should correctly convert to base64 and back', () => {
      const { toBase64, fromBase64 } = require('@hyperfrontend/string-utils/node')

      const original = 'Hello, World!'
      const base64 = toBase64(original)
      const result = fromBase64(base64)

      expect(result).toBe(original)
    })
  })

  // Note: browser sub-entry is not tested in Node.js environment
})
