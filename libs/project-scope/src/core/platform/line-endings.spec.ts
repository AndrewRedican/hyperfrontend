import { describe, expect, it } from '@hyperfrontend/testing'
import { isCaseSensitiveFs } from './detect'
import { getLineEnding, getPathSeparator, normalizeLineEndings, detectLineEnding, pathsEqual, LF, CRLF } from './line-endings'

describe('core/platform/line-endings', () => {
  describe('getLineEnding', () => {
    it('returns a valid line ending', () => {
      const ending = getLineEnding()
      expect([LF, CRLF]).toContain(ending)
    })
  })

  describe('getPathSeparator', () => {
    it('returns a valid path separator', () => {
      const sep = getPathSeparator()
      expect(['/', '\\']).toContain(sep)
    })
  })

  describe('normalizeLineEndings', () => {
    it('normalizes CRLF to LF', () => {
      expect(normalizeLineEndings('a\r\nb\r\nc', 'lf')).toBe('a\nb\nc')
    })

    it('normalizes CR to LF', () => {
      expect(normalizeLineEndings('a\rb\rc', 'lf')).toBe('a\nb\nc')
    })

    it('normalizes LF to CRLF', () => {
      expect(normalizeLineEndings('a\nb\nc', 'crlf')).toBe('a\r\nb\r\nc')
    })

    it('handles auto mode based on platform', () => {
      const result = normalizeLineEndings('a\nb\nc', 'auto')
      expect(result).toMatch(/a[\r]?\nb[\r]?\nc/)
    })

    it('defaults to LF when no style specified', () => {
      expect(normalizeLineEndings('a\r\nb\r\nc')).toBe('a\nb\nc')
    })
  })

  describe('detectLineEnding', () => {
    it('detects CRLF', () => {
      expect(detectLineEnding('a\r\nb')).toBe('crlf')
    })

    it('detects LF', () => {
      expect(detectLineEnding('a\nb')).toBe('lf')
    })

    it('detects mixed line endings', () => {
      expect(detectLineEnding('a\r\nb\nc')).toBe('mixed')
    })

    it('detects no line endings', () => {
      expect(detectLineEnding('abc')).toBe('none')
    })

    it('handles empty string', () => {
      expect(detectLineEnding('')).toBe('none')
    })
  })

  describe('pathsEqual', () => {
    it('returns true for identical paths', () => {
      expect(pathsEqual('/a/b/c', '/a/b/c')).toBe(true)
    })

    it('returns false for different paths', () => {
      expect(pathsEqual('/a/b/c', '/a/b/d')).toBe(false)
    })

    it('handles case sensitivity correctly on case-sensitive systems', () => {
      const caseSensitive = isCaseSensitiveFs()
      expect(pathsEqual('/a/B/c', '/a/b/c')).toBe(!caseSensitive)
    })
  })
})
