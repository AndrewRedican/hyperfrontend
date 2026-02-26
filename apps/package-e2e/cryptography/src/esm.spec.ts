/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/cryptography
 * Tests that the package sub-entries are importable and exports work correctly.
 *
 * Note: cryptography has platform-specific entries: ./browser, ./node, ./common
 */

describe('@hyperfrontend/cryptography ESM', () => {
  describe('node sub-entry', () => {
    it('should be importable', async () => {
      const nodeEntry = await import('@hyperfrontend/cryptography/node')
      expect(nodeEntry).toBeDefined()
    })

    it('should export createHash function', async () => {
      const { createHash } = await import('@hyperfrontend/cryptography/node')
      expect(typeof createHash).toBe('function')
    })

    it('should export encrypt function', async () => {
      const { encrypt } = await import('@hyperfrontend/cryptography/node')
      expect(typeof encrypt).toBe('function')
    })

    it('should export decrypt function', async () => {
      const { decrypt } = await import('@hyperfrontend/cryptography/node')
      expect(typeof decrypt).toBe('function')
    })

    it('should export createVault function', async () => {
      const { createVault } = await import('@hyperfrontend/cryptography/node')
      expect(typeof createVault).toBe('function')
    })

    it('should export generateKey function', async () => {
      const { generateKey } = await import('@hyperfrontend/cryptography/node')
      expect(typeof generateKey).toBe('function')
    })

    it('should export getRandomValues function', async () => {
      const { getRandomValues } = await import('@hyperfrontend/cryptography/node')
      expect(typeof getRandomValues).toBe('function')
    })

    it('should export getTimeBasedPassword function', async () => {
      const { getTimeBasedPassword } = await import('@hyperfrontend/cryptography/node')
      expect(typeof getTimeBasedPassword).toBe('function')
    })

    it('should export isSHA256Hash function', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/node')
      expect(typeof isSHA256Hash).toBe('function')
    })
  })

  describe('common sub-entry', () => {
    it('should be importable', async () => {
      const commonEntry = await import('@hyperfrontend/cryptography/common')
      expect(commonEntry).toBeDefined()
    })

    it('should export isSHA256Hash function', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/common')
      expect(typeof isSHA256Hash).toBe('function')
    })

    it('isSHA256Hash should validate hash format', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/common')

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
