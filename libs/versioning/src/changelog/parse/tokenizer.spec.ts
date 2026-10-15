import { describe, expect, it } from '@hyperfrontend/testing'
import { tokenize, isLetter, isDigit, isAlphanumeric } from './tokenizer'

describe('tokenize', () => {
  describe('basic tokenization', () => {
    it('tokenizes an empty string', () => {
      const tokens = tokenize('')
      expect(tokens).toEqual([expect.objectContaining({ type: 'eof' })])
    })

    it('tokenizes plain text', () => {
      const tokens = tokenize('Hello world')
      expect(tokens).toEqual([expect.objectContaining({ type: 'text', value: 'Hello world' }), expect.objectContaining({ type: 'eof' })])
    })

    it('tokenizes text with newlines', () => {
      const tokens = tokenize('Line 1\nLine 2')
      expect(tokens).toEqual([
        expect.objectContaining({ type: 'text', value: 'Line 1' }),
        expect.objectContaining({ type: 'newline' }),
        expect.objectContaining({ type: 'text', value: 'Line 2' }),
        expect.objectContaining({ type: 'eof' }),
      ])
    })

    it('handles blank lines', () => {
      const tokens = tokenize('Line 1\n\nLine 2')
      expect(tokens.filter((t) => t.type === 'blank-line')).toHaveLength(1)
    })
  })

  describe('headings', () => {
    it('tokenizes h1 heading', () => {
      const tokens = tokenize('# Changelog')
      expect(tokens[0]).toMatchObject({
        type: 'heading-1',
        value: 'Changelog',
        line: 1,
      })
    })

    it('tokenizes h2 heading', () => {
      const tokens = tokenize('## [1.0.0] - 2024-01-01')
      expect(tokens[0]).toMatchObject({
        type: 'heading-2',
        value: '[1.0.0] - 2024-01-01',
      })
    })

    it('tokenizes h3 heading', () => {
      const tokens = tokenize('### Features')
      expect(tokens[0]).toMatchObject({
        type: 'heading-3',
        value: 'Features',
      })
    })

    it('tokenizes h4 heading', () => {
      const tokens = tokenize('#### Sub-section')
      expect(tokens[0]).toMatchObject({
        type: 'heading-4',
        value: 'Sub-section',
      })
    })

    it('only recognizes headings at start of line', () => {
      const tokens = tokenize('some text # not a heading')
      expect(tokens.find((t) => t.type === 'heading-1')).toBeUndefined()
    })
  })

  describe('list items', () => {
    it('tokenizes list item with dash', () => {
      const tokens = tokenize('- Item one')
      expect(tokens[0]).toMatchObject({
        type: 'list-item',
        value: 'Item one',
      })
    })

    it('tokenizes list item with asterisk', () => {
      const tokens = tokenize('* Item one')
      expect(tokens[0]).toMatchObject({
        type: 'list-item',
        value: 'Item one',
      })
    })

    it('does not treat asterisk without space as list item', () => {
      const tokens = tokenize('*bold text*')
      expect(tokens.find((t) => t.type === 'list-item')).toBeUndefined()
    })

    it('parses multiple list items', () => {
      const tokens = tokenize('- Item 1\n- Item 2\n- Item 3')
      const listItems = tokens.filter((t) => t.type === 'list-item')
      expect(listItems.map((t) => t.value)).toEqual(['Item 1', 'Item 2', 'Item 3'])
    })
  })

  describe('links', () => {
    it('tokenizes a markdown link', () => {
      const tokens = tokenize('[text](url)')
      expect(tokens).toEqual([
        expect.objectContaining({ type: 'link-text', value: 'text' }),
        expect.objectContaining({ type: 'link-url', value: 'url' }),
        expect.objectContaining({ type: 'eof' }),
      ])
    })

    it('tokenizes a link with full URL', () => {
      const tokens = tokenize('[Keep a Changelog](https://keepachangelog.com)')
      expect(tokens).toEqual([
        expect.objectContaining({ type: 'link-text', value: 'Keep a Changelog' }),
        expect.objectContaining({ type: 'link-url', value: 'https://keepachangelog.com' }),
        expect.objectContaining({ type: 'eof' }),
      ])
    })

    it('handles unclosed bracket as text', () => {
      const tokens = tokenize('[unclosed')
      expect(tokens).toEqual([
        expect.objectContaining({ type: 'text', value: '[' }),
        expect.objectContaining({ type: 'text', value: 'unclosed' }),
        expect.objectContaining({ type: 'eof' }),
      ])
    })

    it('handles bracket without url as text', () => {
      const tokens = tokenize('[text] not a link')
      expect(tokens[0]).toMatchObject({ type: 'text', value: '[text]' })
    })
  })

  describe('code', () => {
    it('tokenizes inline code', () => {
      const tokens = tokenize('`code`')
      expect(tokens[0]).toMatchObject({ type: 'code', value: 'code' })
    })

    it('handles unclosed backtick as text', () => {
      const tokens = tokenize('`unclosed')
      expect(tokens[0]).toMatchObject({ type: 'text', value: '`unclosed' })
    })
  })

  describe('bold', () => {
    it('tokenizes bold text', () => {
      const tokens = tokenize('**bold text**')
      expect(tokens[0]).toMatchObject({ type: 'bold', value: 'bold text' })
    })

    it('handles unclosed bold as text', () => {
      const tokens = tokenize('**unclosed')
      expect(tokens[0]).toMatchObject({ type: 'text', value: '**unclosed' })
    })
  })

  describe('real changelog content', () => {
    it('tokenizes a simple changelog', () => {
      const content = `# Changelog

All notable changes will be documented here.

## [1.0.0] - 2024-01-01

### Added

- First feature
- Second feature

### Fixed

- Bug fix one
`

      const tokens = tokenize(content)

      const outline = tokens.filter((t) => t.type.startsWith('heading-') || t.type === 'list-item').map((t) => [t.type, t.value])
      expect(outline).toEqual([
        ['heading-1', 'Changelog'],
        ['heading-2', '[1.0.0] - 2024-01-01'],
        ['heading-3', 'Added'],
        ['list-item', 'First feature'],
        ['list-item', 'Second feature'],
        ['heading-3', 'Fixed'],
        ['list-item', 'Bug fix one'],
      ])
    })
  })

  describe('error handling', () => {
    it('throws on input exceeding max length', () => {
      const longInput = 'x'.repeat(1024 * 1024 + 1)
      expect(() => tokenize(longInput)).toThrow('exceeds maximum length')
    })
  })

  describe('line tracking', () => {
    it('tracks line numbers correctly', () => {
      const tokens = tokenize('# Title\n\n## Version\n- Item')

      const title = tokens.find((t) => t.type === 'heading-1')
      const version = tokens.find((t) => t.type === 'heading-2')
      const item = tokens.find((t) => t.type === 'list-item')
      expect({ title: title?.line, version: version?.line, item: item?.line }).toEqual({ title: 1, version: 3, item: 4 })
    })
  })

  describe('CRLF handling', () => {
    it('handles Windows line endings', () => {
      const tokens = tokenize('Line 1\r\nLine 2')
      expect(tokens.filter((t) => t.type === 'text')).toHaveLength(2)
    })
  })

  describe('code tokenization edge cases', () => {
    it('handles code with newline before closing (unclosed code at end of line)', () => {
      const tokens = tokenize('`code\nmore')
      expect(tokens.find((t) => t.type === 'text' && t.value.includes('`code'))).toBeDefined()
    })
  })

  describe('bold tokenization edge cases', () => {
    it('handles bold spanning multiple lines', () => {
      const tokens = tokenize('**bold\ntext**')
      expect(tokens.find((t) => t.type === 'bold' && t.value.includes('bold'))).toBeDefined()
    })

    it('handles bold that reaches end of input without closing', () => {
      const tokens = tokenize('**unclosed')
      expect(tokens.find((t) => t.type === 'text' && t.value.startsWith('**'))).toBeDefined()
    })

    it('handles bold with newline in middle', () => {
      const tokens = tokenize('**first\nsecond**')
      expect(tokens.find((t) => t.type === 'bold')).toEqual(expect.objectContaining({ value: 'first\nsecond' }))
    })
  })

  describe('text tokenization edge cases', () => {
    it('stops at asterisk when followed by another asterisk', () => {
      const tokens = tokenize('text**bold**')
      expect(tokens).toEqual([
        expect.objectContaining({ type: 'text', value: 'text' }),
        expect.objectContaining({ type: 'bold', value: 'bold' }),
        expect.objectContaining({ type: 'eof' }),
      ])
    })

    it('stops at backtick', () => {
      const tokens = tokenize('text`code`')
      expect(tokens).toEqual([
        expect.objectContaining({ type: 'text', value: 'text' }),
        expect.objectContaining({ type: 'code', value: 'code' }),
        expect.objectContaining({ type: 'eof' }),
      ])
    })

    it('stops at bracket', () => {
      const tokens = tokenize('text[link](url)')
      expect(tokens).toEqual([
        expect.objectContaining({ type: 'text', value: 'text' }),
        expect.objectContaining({ type: 'link-text', value: 'link' }),
        expect.objectContaining({ type: 'link-url', value: 'url' }),
        expect.objectContaining({ type: 'eof' }),
      ])
    })

    it('stops at carriage return', () => {
      const tokens = tokenize('text\rmore')
      const textTokens = tokens.filter((t) => t.type === 'text')
      expect(textTokens.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('link tokenization edge cases', () => {
    it('handles link text spanning multiple lines (emits [ as text)', () => {
      const tokens = tokenize('[link\ntext](url)')
      expect(tokens.find((t) => t.type === 'text' && t.value === '[')).toBeDefined()
    })

    it('handles unclosed link bracket (no closing ])', () => {
      const tokens = tokenize('[unclosed link text')
      expect(tokens.find((t) => t.type === 'text' && t.value === '[')).toBeDefined()
    })

    it('handles nested brackets in link text', () => {
      const tokens = tokenize('[outer [inner] text](url)')
      expect(tokens.find((t) => t.type === 'link-text')).toBeDefined()
    })

    it('handles link without URL', () => {
      const tokens = tokenize('[link text] no url')
      expect(tokens.find((t) => t.type === 'text' && t.value === '[link text]')).toBeDefined()
    })

    it('handles link URL spanning lines', () => {
      const tokens = tokenize('[text](http://\nexample.com)')
      const linkUrl = tokens.find((t) => t.type === 'link-url')
      expect(linkUrl).toBeUndefined()
    })

    it('handles unclosed URL parenthesis', () => {
      const tokens = tokenize('[text](url-without-closing')
      expect(tokens.find((t) => t.type === 'text' && t.value === '[text]')).toBeDefined()
    })
  })
})

describe('helper functions', () => {
  describe('isLetter', () => {
    it('returns true for lowercase letters', () => {
      expect(['a', 'z'].map((char) => isLetter(char))).toEqual([true, true])
    })

    it('returns true for uppercase letters', () => {
      expect(['A', 'Z'].map((char) => isLetter(char))).toEqual([true, true])
    })

    it('returns false for digits', () => {
      expect(['0', '9'].map((char) => isLetter(char))).toEqual([false, false])
    })

    it('returns false for undefined', () => {
      expect(isLetter(undefined)).toBe(false)
    })
  })

  describe('isDigit', () => {
    it('returns true for digits', () => {
      expect(['0', '9'].map((char) => isDigit(char))).toEqual([true, true])
    })

    it('returns false for letters', () => {
      expect(isDigit('a')).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isDigit(undefined)).toBe(false)
    })
  })

  describe('isAlphanumeric', () => {
    it('returns true for letters', () => {
      expect(['a', 'Z'].map((char) => isAlphanumeric(char))).toEqual([true, true])
    })

    it('returns true for digits', () => {
      expect(isAlphanumeric('5')).toBe(true)
    })

    it('returns false for special characters', () => {
      expect(isAlphanumeric('!')).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isAlphanumeric(undefined)).toBe(false)
    })
  })
})
