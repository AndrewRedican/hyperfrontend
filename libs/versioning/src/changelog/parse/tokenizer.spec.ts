import { tokenize, isLetter, isDigit, isAlphanumeric } from './tokenizer'

describe('tokenize', () => {
  describe('basic tokenization', () => {
    it('tokenizes an empty string', () => {
      const tokens = tokenize('')
      expect(tokens).toHaveLength(1)
      expect(tokens[0].type).toBe('eof')
    })

    it('tokenizes plain text', () => {
      const tokens = tokenize('Hello world')
      expect(tokens).toHaveLength(2)
      expect(tokens[0]).toMatchObject({ type: 'text', value: 'Hello world' })
      expect(tokens[1].type).toBe('eof')
    })

    it('tokenizes text with newlines', () => {
      const tokens = tokenize('Line 1\nLine 2')
      expect(tokens).toHaveLength(4)
      expect(tokens[0]).toMatchObject({ type: 'text', value: 'Line 1' })
      expect(tokens[1]).toMatchObject({ type: 'newline' })
      expect(tokens[2]).toMatchObject({ type: 'text', value: 'Line 2' })
      expect(tokens[3].type).toBe('eof')
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
      expect(listItems).toHaveLength(3)
      expect(listItems[0].value).toBe('Item 1')
      expect(listItems[1].value).toBe('Item 2')
      expect(listItems[2].value).toBe('Item 3')
    })
  })

  describe('links', () => {
    it('tokenizes a markdown link', () => {
      const tokens = tokenize('[text](url)')
      expect(tokens[0]).toMatchObject({ type: 'link-text', value: 'text' })
      expect(tokens[1]).toMatchObject({ type: 'link-url', value: 'url' })
    })

    it('tokenizes a link with full URL', () => {
      const tokens = tokenize('[Keep a Changelog](https://keepachangelog.com)')
      expect(tokens[0]).toMatchObject({
        type: 'link-text',
        value: 'Keep a Changelog',
      })
      expect(tokens[1]).toMatchObject({
        type: 'link-url',
        value: 'https://keepachangelog.com',
      })
    })

    it('handles unclosed bracket as text', () => {
      const tokens = tokenize('[unclosed')
      expect(tokens[0]).toMatchObject({ type: 'text', value: '[' })
      expect(tokens[1]).toMatchObject({ type: 'text', value: 'unclosed' })
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

      const h1 = tokens.find((t) => t.type === 'heading-1')
      expect(h1?.value).toBe('Changelog')

      const h2 = tokens.find((t) => t.type === 'heading-2')
      expect(h2?.value).toBe('[1.0.0] - 2024-01-01')

      const h3s = tokens.filter((t) => t.type === 'heading-3')
      expect(h3s).toHaveLength(2)
      expect(h3s[0].value).toBe('Added')
      expect(h3s[1].value).toBe('Fixed')

      const listItems = tokens.filter((t) => t.type === 'list-item')
      expect(listItems).toHaveLength(3)
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
      expect(title?.line).toBe(1)

      const version = tokens.find((t) => t.type === 'heading-2')
      expect(version?.line).toBe(3)

      const item = tokens.find((t) => t.type === 'list-item')
      expect(item?.line).toBe(4)
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
      const bold = tokens.find((t) => t.type === 'bold')
      expect(bold).toBeDefined()
      expect(bold?.value).toBe('first\nsecond')
    })
  })

  describe('text tokenization edge cases', () => {
    it('stops at asterisk when followed by another asterisk', () => {
      const tokens = tokenize('text**bold**')
      expect(tokens.find((t) => t.type === 'text' && t.value === 'text')).toBeDefined()
      expect(tokens.find((t) => t.type === 'bold' && t.value === 'bold')).toBeDefined()
    })

    it('stops at backtick', () => {
      const tokens = tokenize('text`code`')
      expect(tokens.find((t) => t.type === 'text' && t.value === 'text')).toBeDefined()
      expect(tokens.find((t) => t.type === 'code' && t.value === 'code')).toBeDefined()
    })

    it('stops at bracket', () => {
      const tokens = tokenize('text[link](url)')
      expect(tokens.find((t) => t.type === 'text' && t.value === 'text')).toBeDefined()
      expect(tokens.find((t) => t.type === 'link-text' && t.value === 'link')).toBeDefined()
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
      expect(isLetter('a')).toBe(true)
      expect(isLetter('z')).toBe(true)
    })

    it('returns true for uppercase letters', () => {
      expect(isLetter('A')).toBe(true)
      expect(isLetter('Z')).toBe(true)
    })

    it('returns false for digits', () => {
      expect(isLetter('0')).toBe(false)
      expect(isLetter('9')).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isLetter(undefined)).toBe(false)
    })
  })

  describe('isDigit', () => {
    it('returns true for digits', () => {
      expect(isDigit('0')).toBe(true)
      expect(isDigit('9')).toBe(true)
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
      expect(isAlphanumeric('a')).toBe(true)
      expect(isAlphanumeric('Z')).toBe(true)
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
