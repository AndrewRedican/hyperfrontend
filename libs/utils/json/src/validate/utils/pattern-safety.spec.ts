import { checkPatternSafety } from './pattern-safety'

describe('checkPatternSafety', () => {
  describe('safe patterns', () => {
    it('returns safe for simple patterns', () => {
      expect(checkPatternSafety('^[a-z]+$')).toEqual({ safe: true })
      expect(checkPatternSafety('\\d{3}-\\d{4}')).toEqual({ safe: true })
      expect(checkPatternSafety('[A-Za-z0-9_]+')).toEqual({ safe: true })
      expect(checkPatternSafety('foo|bar|baz')).toEqual({ safe: true })
    })

    it('returns safe for patterns with single quantifiers', () => {
      expect(checkPatternSafety('a+')).toEqual({ safe: true })
      expect(checkPatternSafety('a*')).toEqual({ safe: true })
      expect(checkPatternSafety('a{1,10}')).toEqual({ safe: true })
    })

    it('returns safe for anchored patterns', () => {
      expect(checkPatternSafety('^start')).toEqual({ safe: true })
      expect(checkPatternSafety('end$')).toEqual({ safe: true })
      expect(checkPatternSafety('^exact$')).toEqual({ safe: true })
    })
  })

  describe('nested quantifiers', () => {
    it('detects (a+)+ pattern', () => {
      const result = checkPatternSafety('(a+)+')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Nested quantifiers')
    })

    it('detects (a*)* pattern', () => {
      const result = checkPatternSafety('(a*)*')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Nested quantifiers')
    })

    it('detects (a+)* pattern', () => {
      const result = checkPatternSafety('(a+)*')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Nested quantifiers')
    })

    it('detects ([a-z]+)+ pattern', () => {
      const result = checkPatternSafety('([a-z]+)+')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Nested quantifiers')
    })

    it('detects nested quantifiers with bounds', () => {
      const result = checkPatternSafety('(a+){2,}')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Nested quantifiers')
    })

    it('detects nested quantifiers with upper bound', () => {
      const result = checkPatternSafety('(a+){1,100}')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Nested quantifiers')
    })
  })

  describe('overlapping alternations', () => {
    it('detects (x|x)+ pattern', () => {
      const result = checkPatternSafety('(a|a)+')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Overlapping alternation')
    })

    it('detects (ab|ab)+ pattern', () => {
      const result = checkPatternSafety('(ab|ab)+')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Overlapping alternation')
    })
  })

  describe('large quantifier bounds', () => {
    it('detects extremely large upper bounds', () => {
      const result = checkPatternSafety('a{1,100000}')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('exceeds safe threshold')
    })

    it('allows reasonable bounds', () => {
      expect(checkPatternSafety('a{1,1000}')).toEqual({ safe: true })
      expect(checkPatternSafety('a{1,9999}')).toEqual({ safe: true })
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
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('unbounded wildcards')
    })

    it('detects .+.+ pattern', () => {
      const result = checkPatternSafety('.+.+')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('unbounded wildcards')
    })

    it('detects .* followed by .* with content between', () => {
      const result = checkPatternSafety('.*foo.*')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('unbounded wildcards')
    })
  })
})
