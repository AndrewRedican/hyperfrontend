/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/cryptography`
 * Tests that the package sub-entries are requireable and exports work correctly.
 *
 * Note: cryptography has platform-specific entries: ./browser, ./node, ./common
 */

describe('@hyperfrontend/cryptography CJS', () => {
  describe('node sub-entry', () => {
    it('is requireable', () => {
      const nodeEntry = require('@hyperfrontend/cryptography/node')
      expect(nodeEntry).toBeDefined()
    })

    it('exports createHash function', () => {
      const { createHash } = require('@hyperfrontend/cryptography/node')
      expect(typeof createHash).toBe('function')
    })

    it('exports encrypt function', () => {
      const { encrypt } = require('@hyperfrontend/cryptography/node')
      expect(typeof encrypt).toBe('function')
    })

    it('exports decrypt function', () => {
      const { decrypt } = require('@hyperfrontend/cryptography/node')
      expect(typeof decrypt).toBe('function')
    })

    it('exports createVault function', () => {
      const { createVault } = require('@hyperfrontend/cryptography/node')
      expect(typeof createVault).toBe('function')
    })

    it('exports generateKey function', () => {
      const { generateKey } = require('@hyperfrontend/cryptography/node')
      expect(typeof generateKey).toBe('function')
    })

    it('exports getRandomValues function', () => {
      const { getRandomValues } = require('@hyperfrontend/cryptography/node')
      expect(typeof getRandomValues).toBe('function')
    })

    it('exports getTimeBasedPassword function', () => {
      const { getTimeBasedPassword } = require('@hyperfrontend/cryptography/node')
      expect(typeof getTimeBasedPassword).toBe('function')
    })

    it('exports isSHA256Hash function', () => {
      const { isSHA256Hash } = require('@hyperfrontend/cryptography/node')
      expect(typeof isSHA256Hash).toBe('function')
    })
  })

  describe('common sub-entry', () => {
    it('is requireable', () => {
      const commonEntry = require('@hyperfrontend/cryptography/common')
      expect(commonEntry).toBeDefined()
    })

    it('exports isSHA256Hash function', () => {
      const { isSHA256Hash } = require('@hyperfrontend/cryptography/common')
      expect(typeof isSHA256Hash).toBe('function')
    })

    it('isSHA256Hash validates hash format', () => {
      const { isSHA256Hash } = require('@hyperfrontend/cryptography/common')

      // Valid SHA256 hashes are 64 hex characters
      const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      const invalidHash = 'not-a-hash'

      expect(isSHA256Hash(validHash)).toBe(true)
      expect(isSHA256Hash(invalidHash)).toBe(false)
    })
  })

  // Note: browser sub-entry is not tested in Node.js environment
  // as it uses Web Crypto API which requires browser context
})
