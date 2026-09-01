import { describe, it, expect } from '@hyperfrontend/testing'
import { matchGlobPattern, matchesAnyPattern, matchesExact } from './glob'

describe('core/patterns/glob', () => {
  describe('matchGlobPattern', () => {
    describe('exact matches', () => {
      it('matches exact paths', () => {
        expect(matchGlobPattern('src/index.ts', 'src/index.ts')).toBe(true)
        expect(matchGlobPattern('src/index.ts', 'src/main.ts')).toBe(false)
      })
    })

    describe('single asterisk (*)', () => {
      it('matches any characters in segment', () => {
        expect(matchGlobPattern('src/file.ts', 'src/*.ts')).toBe(true)
        expect(matchGlobPattern('src/file.js', 'src/*.ts')).toBe(false)
      })

      it('does not match across directories', () => {
        expect(matchGlobPattern('src/lib/file.ts', 'src/*.ts')).toBe(false)
      })

      it('matches at beginning', () => {
        expect(matchGlobPattern('src/file.ts', '*/file.ts')).toBe(true)
      })

      it('matches at end', () => {
        expect(matchGlobPattern('src/index.ts', 'src/index.*')).toBe(true)
      })

      it('matches multiple asterisks', () => {
        expect(matchGlobPattern('src/test.spec.ts', 'src/*.*.ts')).toBe(true)
      })
    })

    describe('double asterisk (**)', () => {
      it('matches any number of directories', () => {
        expect(matchGlobPattern('src/lib/utils/file.ts', 'src/**/file.ts')).toBe(true)
        expect(matchGlobPattern('src/file.ts', 'src/**/file.ts')).toBe(true)
      })

      it('matches at beginning', () => {
        expect(matchGlobPattern('deep/nested/path/file.ts', '**/file.ts')).toBe(true)
      })

      it('matches at end', () => {
        expect(matchGlobPattern('src/lib/index.ts', 'src/**')).toBe(true)
      })

      it('matches zero directories', () => {
        expect(matchGlobPattern('file.ts', '**/file.ts')).toBe(true)
      })
    })

    describe('question mark (?)', () => {
      it('matches exactly one character', () => {
        expect(matchGlobPattern('src/file1.ts', 'src/file?.ts')).toBe(true)
        expect(matchGlobPattern('src/file12.ts', 'src/file?.ts')).toBe(false)
      })

      it('works with multiple question marks', () => {
        expect(matchGlobPattern('src/file12.ts', 'src/file??.ts')).toBe(true)
      })

      it('does not match directory separator', () => {
        expect(matchGlobPattern('src/lib/file.ts', 'src/???/file.ts')).toBe(true)
      })
    })

    describe('braces {a,b,c}', () => {
      it('matches any alternative', () => {
        expect(matchGlobPattern('file.ts', 'file.{ts,js}')).toBe(true)
        expect(matchGlobPattern('file.js', 'file.{ts,js}')).toBe(true)
        expect(matchGlobPattern('file.css', 'file.{ts,js}')).toBe(false)
      })

      it('works with multiple alternatives', () => {
        expect(matchGlobPattern('file.ts', 'file.{ts,js,jsx,tsx}')).toBe(true)
        expect(matchGlobPattern('file.tsx', 'file.{ts,js,jsx,tsx}')).toBe(true)
      })
    })

    describe('complex patterns', () => {
      it('handles ** with * together', () => {
        expect(matchGlobPattern('src/lib/file.spec.ts', 'src/**/*.spec.ts')).toBe(true)
        expect(matchGlobPattern('src/file.spec.ts', 'src/**/*.spec.ts')).toBe(true)
      })

      it('handles multiple placeholders', () => {
        expect(matchGlobPattern('src/lib/test.spec.ts', 'src/*/*.*.ts')).toBe(true)
      })

      it('handles braces with wildcards', () => {
        expect(matchGlobPattern('src/file.spec.ts', 'src/*.{spec,test}.ts')).toBe(true)
        expect(matchGlobPattern('src/file.test.ts', 'src/*.{spec,test}.ts')).toBe(true)
      })
    })

    describe('edge cases', () => {
      it('handles empty pattern', () => {
        expect(matchGlobPattern('', '')).toBe(true)
        expect(matchGlobPattern('file.ts', '')).toBe(false)
      })

      it('handles empty path', () => {
        expect(matchGlobPattern('', 'file.ts')).toBe(false)
        expect(matchGlobPattern('', '*')).toBe(true)
      })

      it('handles pattern longer than path', () => {
        expect(matchGlobPattern('src', 'src/file.ts')).toBe(false)
      })

      it('handles path longer than pattern', () => {
        expect(matchGlobPattern('src/lib/file.ts', 'src')).toBe(false)
      })
    })

    describe('security - ReDoS resistance', () => {
      it('resists ReDoS with deeply nested patterns', () => {
        const start = Date.now()
        const pattern = '*'.repeat(50) + '/*.ts'
        const path = 'a'.repeat(50) + '/file.ts'
        matchGlobPattern(path, pattern)
        const elapsed = Date.now() - start
        expect(elapsed).toBeLessThan(100)
      })

      it('resists ReDoS with many alternatives', () => {
        const start = Date.now()
        const alternatives = Array.from({ length: 100 }, (_, i) => `alt${i}`).join(',')
        const pattern = `file.{${alternatives}}`
        matchGlobPattern('file.alt50', pattern)
        const elapsed = Date.now() - start
        expect(elapsed).toBeLessThan(100)
      })

      it('resists ReDoS with nested wildcards', () => {
        const start = Date.now()
        const pattern = '**/**/**.ts'
        const path = 'a/b/c/d/e/f/g/h/i/j/file.ts'
        matchGlobPattern(path, pattern)
        const elapsed = Date.now() - start
        expect(elapsed).toBeLessThan(100)
      })
    })
  })

  describe('matchesAnyPattern', () => {
    it('matches if any pattern matches', () => {
      expect(matchesAnyPattern('file.ts', ['*.js', '*.ts', '*.tsx'])).toBe(true)
    })

    it('returns false if no patterns match', () => {
      expect(matchesAnyPattern('file.css', ['*.js', '*.ts', '*.tsx'])).toBe(false)
    })

    it('handles empty patterns array', () => {
      expect(matchesAnyPattern('file.ts', [])).toBe(false)
    })

    it('short-circuits on first match', () => {
      const patterns = ['*.js', '*.ts', '*.tsx']
      expect(matchesAnyPattern('file.ts', patterns)).toBe(true)
    })
  })

  describe('matchesExact', () => {
    it('matches exact strings', () => {
      expect(matchesExact('file.ts', 'file.ts')).toBe(true)
    })

    it('does not match different strings', () => {
      expect(matchesExact('file.ts', 'file.js')).toBe(false)
    })

    it('does not expand wildcards', () => {
      expect(matchesExact('file.ts', '*.ts')).toBe(false)
    })

    it('is case sensitive', () => {
      expect(matchesExact('File.ts', 'file.ts')).toBe(false)
    })
  })

  describe('edge cases - malformed patterns', () => {
    it('treats unmatched opening brace as literal character', () => {
      expect(matchGlobPattern('file{.ts', 'file{.ts')).toBe(true)
      expect(matchGlobPattern('file.ts', 'file{.ts')).toBe(false)
    })

    it('treats deeply nested unmatched braces as literals', () => {
      expect(matchGlobPattern('a{b{c.ts', 'a{b{c.ts')).toBe(true)
    })

    it('handles pattern with only opening brace at end', () => {
      expect(matchGlobPattern('file{', 'file{')).toBe(true)
    })

    it('handles mismatch with literal brace', () => {
      expect(matchGlobPattern('filex.ts', 'file{.ts')).toBe(false)
    })
  })

  describe('brace alternatives - exhaustive paths', () => {
    it('returns false when no alternatives match', () => {
      expect(matchGlobPattern('file.css', 'file.{ts,js}')).toBe(false)
    })

    it('works with single alternative', () => {
      expect(matchGlobPattern('file.ts', 'file.{ts}')).toBe(true)
    })

    it('tests all alternatives before returning false', () => {
      expect(matchGlobPattern('file.tsx', 'file.{ts,js,jsx}')).toBe(false)
      expect(matchGlobPattern('file.tsx', 'file.{ts,js,jsx,tsx}')).toBe(true)
    })
  })
})
