import { describe, expect, it } from '@hyperfrontend/testing'
import { checkPatternSafety } from './pattern-safety'

describe('checkPatternSafety', () => {
  describe('safe patterns', () => {
    it.each(['^[a-z]+$', '\\d{3}-\\d{4}', '[A-Za-z0-9_]+', 'foo|bar|baz'])('returns safe for the simple pattern %p', (pattern: string) => {
      expect(checkPatternSafety(pattern)).toEqual({ safe: true })
    })

    it.each(['a+', 'a*', 'a{1,10}'])('returns safe for the single-quantifier pattern %p', (pattern: string) => {
      expect(checkPatternSafety(pattern)).toEqual({ safe: true })
    })

    it.each(['^start', 'end$', '^exact$'])('returns safe for the anchored pattern %p', (pattern: string) => {
      expect(checkPatternSafety(pattern)).toEqual({ safe: true })
    })
  })

  describe('nested quantifiers', () => {
    it('detects (a+)+ pattern', () => {
      const result = checkPatternSafety('(a+)+')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('Nested quantifiers') })
    })

    it('detects (a*)* pattern', () => {
      const result = checkPatternSafety('(a*)*')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('Nested quantifiers') })
    })

    it('detects (a+)* pattern', () => {
      const result = checkPatternSafety('(a+)*')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('Nested quantifiers') })
    })

    it('detects ([a-z]+)+ pattern', () => {
      const result = checkPatternSafety('([a-z]+)+')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('Nested quantifiers') })
    })

    it('detects nested quantifiers with bounds', () => {
      const result = checkPatternSafety('(a+){2,}')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('Nested quantifiers') })
    })

    it('detects nested quantifiers with upper bound', () => {
      const result = checkPatternSafety('(a+){1,100}')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('Nested quantifiers') })
    })
  })

  describe('overlapping alternations', () => {
    it('detects (x|x)+ pattern', () => {
      const result = checkPatternSafety('(a|a)+')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('Overlapping alternation') })
    })

    it('detects (ab|ab)+ pattern', () => {
      const result = checkPatternSafety('(ab|ab)+')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('Overlapping alternation') })
    })
  })

  describe('large quantifier bounds', () => {
    it('detects extremely large upper bounds', () => {
      const result = checkPatternSafety('a{1,100000}')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('exceeds safe threshold') })
    })

    it.each(['a{1,1000}', 'a{1,9999}'])('allows the reasonable bound %p', (pattern: string) => {
      expect(checkPatternSafety(pattern)).toEqual({ safe: true })
    })

    it('handles pattern with no quantifier braces', () => {
      expect(checkPatternSafety('abc')).toEqual({ safe: true })
    })

    it('handles pattern with unclosed quantifier brace', () => {
      expect(checkPatternSafety('a{1,100')).toEqual({ safe: true })
    })

    it('handles pattern with exact count (no comma)', () => {
      expect(checkPatternSafety('a{5}')).toEqual({ safe: true })
    })

    it('handles pattern with open-ended range (no upper bound)', () => {
      expect(checkPatternSafety('a{5,}')).toEqual({ safe: true })
    })
  })

  describe('multiple unbounded wildcards', () => {
    it('detects .*.* pattern', () => {
      const result = checkPatternSafety('.*.*')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('unbounded wildcards') })
    })

    it('detects .+.+ pattern', () => {
      const result = checkPatternSafety('.+.+')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('unbounded wildcards') })
    })

    it('detects .* followed by .* with content between', () => {
      const result = checkPatternSafety('.*foo.*')
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('unbounded wildcards') })
    })
  })

  describe('pattern length limits', () => {
    it('rejects patterns exceeding maximum length', () => {
      const longPattern = 'a'.repeat(1001)
      const result = checkPatternSafety(longPattern)
      expect(result).toEqual({ safe: false, reason: expect.stringContaining('exceeds maximum allowed') })
    })

    it('allows patterns at the maximum length boundary', () => {
      const maxLengthPattern = 'a'.repeat(1000)
      expect(checkPatternSafety(maxLengthPattern)).toEqual({ safe: true })
    })
  })
})
