import { describe, it, expect } from '@hyperfrontend/testing'
import { matchGlobPattern, matchesAnyPattern, matchesExact } from './glob'

describe('core/patterns/glob', () => {
  describe('matchGlobPattern', () => {
    describe('exact matches', () => {
      it('matches an identical path', () => {
        expect(matchGlobPattern('src/index.ts', 'src/index.ts')).toBe(true)
      })

      it('rejects a path that differs from the literal pattern', () => {
        expect(matchGlobPattern('src/index.ts', 'src/main.ts')).toBe(false)
      })
    })

    describe('single asterisk (*)', () => {
      it('matches any characters in segment', () => {
        expect(matchGlobPattern('src/file.ts', 'src/*.ts')).toBe(true)
      })

      it('rejects a segment whose literal tail differs', () => {
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
      it.each(['src/lib/utils/file.ts', 'src/file.ts'])('matches %s against src/**/file.ts', (path: string) => {
        expect(matchGlobPattern(path, 'src/**/file.ts')).toBe(true)
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
      })

      it('rejects two characters for one question mark', () => {
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
      it.each(['file.ts', 'file.js'])('matches %s against file.{ts,js}', (path: string) => {
        expect(matchGlobPattern(path, 'file.{ts,js}')).toBe(true)
      })

      it('rejects an extension outside the alternatives', () => {
        expect(matchGlobPattern('file.css', 'file.{ts,js}')).toBe(false)
      })

      it.each(['file.ts', 'file.tsx'])('matches %s against file.{ts,js,jsx,tsx}', (path: string) => {
        expect(matchGlobPattern(path, 'file.{ts,js,jsx,tsx}')).toBe(true)
      })
    })

    describe('complex patterns', () => {
      it.each(['src/lib/file.spec.ts', 'src/file.spec.ts'])('matches %s against src/**/*.spec.ts', (path: string) => {
        expect(matchGlobPattern(path, 'src/**/*.spec.ts')).toBe(true)
      })

      it('handles multiple placeholders', () => {
        expect(matchGlobPattern('src/lib/test.spec.ts', 'src/*/*.*.ts')).toBe(true)
      })

      it.each(['src/file.spec.ts', 'src/file.test.ts'])('matches %s against src/*.{spec,test}.ts', (path: string) => {
        expect(matchGlobPattern(path, 'src/*.{spec,test}.ts')).toBe(true)
      })
    })

    describe('edge cases', () => {
      it('matches an empty path against an empty pattern', () => {
        expect(matchGlobPattern('', '')).toBe(true)
      })

      it('rejects a non-empty path against an empty pattern', () => {
        expect(matchGlobPattern('file.ts', '')).toBe(false)
      })

      it('rejects an empty path against a literal pattern', () => {
        expect(matchGlobPattern('', 'file.ts')).toBe(false)
      })

      it('matches an empty path against a lone asterisk', () => {
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
    })

    it('rejects a path missing the literal unmatched brace', () => {
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

    it('rejects a path once every alternative has been tried', () => {
      expect(matchGlobPattern('file.tsx', 'file.{ts,js,jsx}')).toBe(false)
    })

    it('matches the last alternative in the list', () => {
      expect(matchGlobPattern('file.tsx', 'file.{ts,js,jsx,tsx}')).toBe(true)
    })
  })
})
