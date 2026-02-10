import { detectPlatform } from './platform'

describe('security/platform (node)', () => {
  describe('detectPlatform', () => {
    it('returns node when running in Node.js environment', () => {
      expect(typeof window).toBe('undefined')
      expect(typeof process.versions.node).toBe('string')

      const platform = detectPlatform()

      expect(platform).toBe('node')
    })

    it('detects node via process.versions.node', () => {
      expect(process.versions).toBeDefined()
      expect(process.versions.node).toBeDefined()

      const platform = detectPlatform()

      expect(platform).toBe('node')
    })
  })
})
