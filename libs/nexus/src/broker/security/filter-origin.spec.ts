import { describe, expect, it } from '@hyperfrontend/testing'
import { filterOrigin } from './filter-origin'

describe('filterOrigin', () => {
  const testOrigin = 'https://example.com'
  const otherOrigin = 'https://other.com'

  describe('with whitelist', () => {
    it('allows origin in whitelist', () => {
      const result = filterOrigin(testOrigin, [testOrigin], [])
      expect(result).toBe(true)
    })

    it('block origin not in whitelist', () => {
      const result = filterOrigin(testOrigin, [otherOrigin], [])
      expect(result).toBe(false)
    })

    it('prioritizes whitelist over blacklist', () => {
      const result = filterOrigin(testOrigin, [testOrigin], [testOrigin])
      expect(result).toBe(true)
    })

    it('handles multiple origins in whitelist', () => {
      const result = filterOrigin(testOrigin, [otherOrigin, testOrigin, 'https://third.com'], [])
      expect(result).toBe(true)
    })
  })

  describe('with blacklist', () => {
    it('block origin in blacklist', () => {
      const result = filterOrigin(testOrigin, [], [testOrigin])
      expect(result).toBe(false)
    })

    it('allows origin not in blacklist', () => {
      const result = filterOrigin(testOrigin, [], [otherOrigin])
      expect(result).toBe(true)
    })

    it('handles multiple origins in blacklist', () => {
      const result = filterOrigin(testOrigin, [], [otherOrigin, testOrigin, 'https://third.com'])
      expect(result).toBe(false)
    })
  })

  describe('without restrictions', () => {
    it('allows origin when no lists provided', () => {
      const result = filterOrigin(testOrigin, [], [])
      expect(result).toBe(true)
    })

    it('allows origin when lists are undefined', () => {
      const result = filterOrigin(testOrigin)
      expect(result).toBe(true)
    })

    it('allows origin when lists are empty', () => {
      const result = filterOrigin(testOrigin, [], [])
      expect(result).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles empty string origin', () => {
      const result = filterOrigin('', ['https://example.com'], [])
      expect(result).toBe(false)
    })

    it('be case-sensitive', () => {
      const result = filterOrigin('https://Example.com', ['https://example.com'], [])
      expect(result).toBe(false)
    })

    it('handles exact string matching', () => {
      const result = filterOrigin('https://example.com', ['https://example.com/path'], [])
      expect(result).toBe(false)
    })
  })
})
