/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/cryptography`
 * Tests that the package sub-entries are importable and exports work correctly.
 *
 * Note: cryptography has platform-specific entries: ./browser, ./node, ./common
 */

describe('@hyperfrontend/cryptography ESM', () => {
  describe('node sub-entry', () => {
    it('is importable', async () => {
      const nodeEntry = await import('@hyperfrontend/cryptography/node')
      expect(nodeEntry).toBeDefined()
    })

    it('exports createHash function', async () => {
      const { createHash } = await import('@hyperfrontend/cryptography/node')
      expect(typeof createHash).toBe('function')
    })

    it('exports encrypt function', async () => {
      const { encrypt } = await import('@hyperfrontend/cryptography/node')
      expect(typeof encrypt).toBe('function')
    })

    it('exports decrypt function', async () => {
      const { decrypt } = await import('@hyperfrontend/cryptography/node')
      expect(typeof decrypt).toBe('function')
    })

    it('exports createVault function', async () => {
      const { createVault } = await import('@hyperfrontend/cryptography/node')
      expect(typeof createVault).toBe('function')
    })

    it('exports generateKey function', async () => {
      const { generateKey } = await import('@hyperfrontend/cryptography/node')
      expect(typeof generateKey).toBe('function')
    })

    it('exports getRandomValues function', async () => {
      const { getRandomValues } = await import('@hyperfrontend/cryptography/node')
      expect(typeof getRandomValues).toBe('function')
    })

    it('exports getTimeBasedPassword function', async () => {
      const { getTimeBasedPassword } = await import('@hyperfrontend/cryptography/node')
      expect(typeof getTimeBasedPassword).toBe('function')
    })

    it('exports isSHA256Hash function', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/node')
      expect(typeof isSHA256Hash).toBe('function')
    })
  })

  describe('common sub-entry', () => {
    it('is importable', async () => {
      const commonEntry = await import('@hyperfrontend/cryptography/common')
      expect(commonEntry).toBeDefined()
    })

    it('exports isSHA256Hash function', async () => {
      const { isSHA256Hash } = await import('@hyperfrontend/cryptography/common')
      expect(typeof isSHA256Hash).toBe('function')
    })

    it('isSHA256Hash validates hash format', async () => {
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
