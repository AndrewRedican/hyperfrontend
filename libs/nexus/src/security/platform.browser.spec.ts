import { detectPlatform } from './platform'

describe('security/platform', () => {
  describe('detectPlatform', () => {
    it('returns browser when window and document are defined', () => {
      const platform = detectPlatform()
      expect(platform).toBe('browser')
    })

    it('returns browser in jsdom test environment', () => {
      expect(typeof window).toBe('object')
      expect(typeof window.document).toBe('object')

      const platform = detectPlatform()
      expect(platform).toBe('browser')
    })
  })
})
