import { describe, expect, it } from '@hyperfrontend/testing'
import { normalizePath, normalizeToForwardSlashes, normalizeToNative, removeTrailingSlash, ensureTrailingSlash } from './normalize'

describe('core/path/normalize', () => {
  describe('normalizePath', () => {
    it('normalizes forward slashes', () => {
      expect(normalizePath('a/b/c')).toBe('a/b/c')
    })

    it('normalizes path with dot segments', () => {
      expect(normalizePath('a/./b/../c')).toBe('a/c')
    })

    it('handles empty path', () => {
      expect(normalizePath('')).toBe('')
    })
  })

  describe('normalizeToForwardSlashes', () => {
    it('converts to forward slashes', () => {
      expect(normalizeToForwardSlashes('a/b/c')).toBe('a/b/c')
    })

    it('handles empty path', () => {
      expect(normalizeToForwardSlashes('')).toBe('')
    })

    it('normalizes dot segments', () => {
      expect(normalizeToForwardSlashes('a/./b/../c')).toBe('a/c')
    })
  })

  describe('normalizeToNative', () => {
    it('normalizes to native separators', () => {
      const result = normalizeToNative('a/b/c')
      expect(result).toMatch(/^a[/\\]b[/\\]c$/)
    })

    it('handles empty path', () => {
      expect(normalizeToNative('')).toBe('')
    })
  })

  describe('removeTrailingSlash', () => {
    it('removes trailing forward slash', () => {
      expect(removeTrailingSlash('path/')).toBe('path')
    })

    it('removes multiple trailing slashes', () => {
      expect(removeTrailingSlash('path///')).toBe('path')
    })

    it('handles path without trailing slash', () => {
      expect(removeTrailingSlash('path')).toBe('path')
    })

    it('handles empty path', () => {
      expect(removeTrailingSlash('')).toBe('')
    })
  })

  describe('ensureTrailingSlash', () => {
    it('adds trailing slash', () => {
      expect(ensureTrailingSlash('path')).toBe('path/')
    })

    it('does not add duplicate slash', () => {
      expect(ensureTrailingSlash('path/')).toBe('path/')
    })

    it('normalizes multiple slashes', () => {
      expect(ensureTrailingSlash('path///')).toBe('path/')
    })
  })
})
