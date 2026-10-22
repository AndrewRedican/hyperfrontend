/**
 * The scanner: one token at a time from the text, in the mode the parser asks for. A slash is a
 * division until the parser asks for a regular expression, a closing brace is punctuation until
 * the parser asks for the rest of a template, a greater-than is single until the parser asks for
 * a shift, and text inside JSX is scanned only when the parser is between tags. Comments are
 * collected as they are skipped; a parse error is thrown where it is found.
 *
 * @module code/scanner
 */

import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { fromCodePoint } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'
import { PUNCTUATORS, characterAt, isDigit, isIdentifierPart, isIdentifierStart, isLineBreak, isWhitespace } from './scanner-tables.ts'

/** The kinds of token. */
export type TokenKind = 'name' | 'private' | 'number' | 'string' | 'template' | 'regex' | 'jsxtext' | 'punct' | 'eof'

/** Which part of a template a template token is. */
export type TemplatePart = 'full' | 'head' | 'middle' | 'tail'

/** One token. */
export interface Token {
  /** Which kind of token. */
  readonly kind: TokenKind
  /** The offset of its first character. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
  /** The text of a name, the punctuator, or the decoded value of a string; the raw text otherwise. */
  readonly value: string
  /** Whether a line break lies between the previous token and this one. */
  readonly newlineBefore: boolean
  /** Which part of a template a template token is. */
  readonly part: TemplatePart
}

/** One comment. */
export interface Comment {
  /** The offset of its first character, the slash. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
  /** True for a block comment. */
  readonly block: boolean
  /** The text between the delimiters. */
  readonly text: string
}

/** A parse error, with where it was found. */
export class SyntaxFailure extends Error {
  /** The offset the error was found at. */
  readonly offset: number

  /**
   * Creates the failure.
   *
   * @param message - What was wrong
   * @param offset - Where
   */
  constructor(message: string, offset: number) {
    super(message)
    this.offset = offset
  }
}

/** Where the scanner was, for speculation. */
export interface ScannerState {
  /** The offset after the current token. */
  readonly pos: number
  /** The current token. */
  readonly token: Token
  /** How many comments had been collected. */
  readonly comments: number
}

/** The token before any scanning. */
const START: Token = { kind: 'eof', start: 0, end: 0, value: '', newlineBefore: false, part: 'full' }

/** Scans a text. */
export class Scanner {
  /** The source text. */
  readonly text: string
  /** The comments found so far, in source order. */
  readonly comments: Comment[] = []
  /** The current token. */
  token: Token = START
  /** The offset the next scan starts from. */
  private pos = 0

  /**
   * Creates a scanner at the start of a text, past any shebang line.
   *
   * @param text - The source text
   */
  constructor(text: string) {
    this.text = text
    if (text.startsWith('#!')) {
      while (this.pos < text.length && !isLineBreak(text[this.pos])) this.pos += 1
    }
  }

  /**
   * Throws a parse error at an offset.
   *
   * @param message - What was wrong
   * @param offset - Where, the current token's start by default
   */
  fail(message: string, offset = this.token.start): never {
    throw new SyntaxFailure(message, offset)
  }

  /**
   * Where the scanner is, to come back to.
   *
   * @returns The state
   */
  save(): ScannerState {
    return { pos: this.pos, token: this.token, comments: this.comments.length }
  }

  /**
   * Returns to a saved state, dropping the comments found since.
   *
   * @param state - What `save` answered
   */
  restore(state: ScannerState): void {
    this.pos = state.pos
    this.token = state.token
    this.comments.length = state.comments
  }

  /**
   * Scans the next token in the ordinary mode.
   *
   * @returns The token
   */
  scan(): Token {
    const newlineBefore = this.skipTrivia()
    const start = this.pos
    const text = this.text
    if (start >= text.length) return this.set('eof', start, start, '', newlineBefore)
    const char = characterAt(text, start)
    if (isIdentifierStart(char) || char === '\\') return this.set('name', start, this.identifierEnd(start), '', newlineBefore)
    if (isDigit(char) || (char === '.' && isDigit(text[start + 1])))
      return this.set('number', start, this.numberEnd(start), '', newlineBefore)
    if (char === '"' || char === "'") return this.set('string', start, this.stringEnd(start, char), '', newlineBefore)
    if (char === '`') return this.template(start, newlineBefore)
    if (char === '#' && isIdentifierStart(text[start + 1]))
      return this.set('private', start, this.identifierEnd(start + 1), '', newlineBefore)
    const punctuator = PUNCTUATORS.find((candidate) => text.startsWith(candidate, start))
    if (punctuator === undefined) this.fail(`Invalid character.`, start)
    if (punctuator === '?.' && isDigit(text[start + 2])) return this.set('punct', start, start + 1, '?', newlineBefore)
    if (punctuator.startsWith('>') && punctuator !== '>') return this.set('punct', start, start + 1, '>', newlineBefore)
    return this.set('punct', start, start + punctuator.length, punctuator, newlineBefore)
  }

  /**
   * Rescans a slash as a regular expression.
   *
   * @returns The regex token
   */
  rescanSlash(): Token {
    const { start, newlineBefore } = this.token
    const text = this.text
    let index = start + 1
    let inClass = false
    for (;;) {
      const char = text[index]
      if (char === undefined || isLineBreak(char)) this.fail('Unterminated regular expression literal.', start)
      if (char === '\\') index += 2
      else {
        if (char === '[') inClass = true
        else if (char === ']') inClass = false
        else if (char === '/' && !inClass) break
        index += 1
      }
    }
    index += 1
    while (isIdentifierPart(text[index])) index += 1
    return this.set('regex', start, index, '', newlineBefore)
  }

  /**
   * Rescans a greater-than as the longest operator it opens: `>>`, `>>>`, `>=`, `>>=`, `>>>=`.
   *
   * @returns The operator token
   */
  rescanGreater(): Token {
    const { start, newlineBefore } = this.token
    const rest = this.text.slice(start, start + 4)
    const operator = ['>>>=', '>>>', '>>=', '>>', '>='].find((candidate) => rest.startsWith(candidate)) ?? '>'
    return this.set('punct', start, start + operator.length, operator, newlineBefore)
  }

  /**
   * Rescans a closing brace as the middle or tail of a template.
   *
   * @returns The template token
   */
  rescanTemplate(): Token {
    return this.template(this.token.start, this.token.newlineBefore)
  }

  /**
   * Scans the next token between JSX tags: a tag start, an expression start, or text up to one.
   *
   * @returns The token
   */
  scanJsxChild(): Token {
    const text = this.text
    const start = this.pos
    if (start >= text.length) return this.set('eof', start, start, '', false)
    if (text[start] === '<' || text[start] === '{') return this.set('punct', start, start + 1, text[start], false)
    let index = start
    while (index < text.length && text[index] !== '<' && text[index] !== '{') {
      if (text[index] === '}' || text[index] === '>')
        this.fail(`Unexpected token. Did you mean \`{'${text[index]}'}\` or \`&${text[index] === '}' ? 'rbrace' : 'gt'};\`?`, index)
      index += 1
    }
    return this.set('jsxtext', start, index, '', false)
  }

  /**
   * Scans the value of a JSX attribute: a string that may span lines, or whatever else follows.
   *
   * @returns The token
   */
  scanJsxAttribute(): Token {
    const newlineBefore = this.skipTrivia()
    const start = this.pos
    const quote = this.text[start]
    if (quote !== '"' && quote !== "'") return this.scan()
    const close = this.text.indexOf(quote, start + 1)
    if (close === -1) this.fail('Unterminated string literal.', start)
    return this.set('string', start, close + 1, '', newlineBefore)
  }

  /**
   * Extends the current name token over the hyphenated parts a JSX name may carry.
   *
   * @returns The name token
   */
  scanJsxName(): Token {
    const text = this.text
    let index = this.token.end
    while (text[index] === '-' || isIdentifierPart(text[index])) index += 1
    return this.set('name', this.token.start, index, '', this.token.newlineBefore)
  }

  /**
   * Scans a template token from a backtick or a closing brace.
   *
   * @param start - The backtick or brace
   * @param newlineBefore - Whether a line break came before it
   * @returns The template token
   */
  private template(start: number, newlineBefore: boolean): Token {
    const text = this.text
    const opening = text[start] === '`'
    let index = start + 1
    for (;;) {
      const char = text[index]
      if (char === undefined) this.fail('Unterminated template literal.', start)
      if (char === '\\') index += 2
      else if (char === '`') return this.set('template', start, index + 1, '', newlineBefore, opening ? 'full' : 'tail')
      else if (char === '$' && text[index + 1] === '{')
        return this.set('template', start, index + 2, '', newlineBefore, opening ? 'head' : 'middle')
      else index += 1
    }
  }

  /**
   * Records the current token.
   *
   * @param kind - Its kind
   * @param start - Its first character
   * @param end - After its last
   * @param value - Its value, read from the text when empty for a name or punctuator
   * @param newlineBefore - Whether a line break came before it
   * @param part - Which part of a template it is
   * @returns The token
   */
  private set(kind: TokenKind, start: number, end: number, value: string, newlineBefore: boolean, part: TemplatePart = 'full'): Token {
    this.pos = end
    this.token = {
      kind,
      start,
      end,
      value: value === '' && (kind === 'name' || kind === 'private') ? decodeName(this.text.slice(start, end)) : value,
      newlineBefore,
      part,
    }
    return this.token
  }

  /**
   * Skips whitespace, line breaks and comments.
   *
   * @returns Whether a line break was crossed
   */
  private skipTrivia(): boolean {
    const text = this.text
    let newline = false
    for (;;) {
      const char = text[this.pos]
      if (isLineBreak(char)) {
        newline = true
        this.pos += 1
      } else if (isWhitespace(char)) this.pos += 1
      else if (char === '/' && text[this.pos + 1] === '/') {
        const start = this.pos
        while (this.pos < text.length && !isLineBreak(text[this.pos])) this.pos += 1
        this.comments.push({ start, end: this.pos, block: false, text: text.slice(start + 2, this.pos) })
      } else if (char === '/' && text[this.pos + 1] === '*') {
        const start = this.pos
        const close = text.indexOf('*/', start + 2)
        if (close === -1) this.fail("'*/' expected.", start)
        if (/[\n\r\u2028\u2029]/.test(text.slice(start, close))) newline = true
        this.pos = close + 2
        this.comments.push({ start, end: this.pos, block: true, text: text.slice(start + 2, close) })
      } else return newline
    }
  }

  /**
   * The end of the identifier starting at an offset, Unicode escapes included.
   *
   * @param start - The first character
   * @returns The offset after the identifier
   */
  private identifierEnd(start: number): number {
    const text = this.text
    let index = start
    for (;;) {
      const char = characterAt(text, index)
      if (char === '\\') {
        if (text[index + 1] !== 'u') this.fail('Invalid character.', index)
        index = text[index + 2] === '{' ? text.indexOf('}', index) + 1 : index + 6
        if (index <= 0) this.fail('Unexpected end of text.', start)
      } else if (char !== undefined && (index === start ? isIdentifierStart(char) : isIdentifierPart(char))) index += char.length
      else return index
    }
  }

  /**
   * The end of the number starting at an offset.
   *
   * @param start - The first character
   * @returns The offset after the number, a `n` suffix included
   */
  private numberEnd(start: number): number {
    const text = this.text
    let index = start
    const digits = (test: (char: string | undefined) => boolean): void => {
      while (test(text[index]) || (text[index] === '_' && test(text[index + 1]))) index += 1
    }
    const prefix = text.slice(start, start + 2).toLowerCase()
    if (prefix === '0x' || prefix === '0o' || prefix === '0b') {
      index += 2
      digits(
        prefix === '0x'
          ? (char) => char !== undefined && /[0-9a-fA-F]/.test(char)
          : prefix === '0o'
            ? (char) => char !== undefined && char >= '0' && char <= '7'
            : (char) => char === '0' || char === '1'
      )
      if (index === start + 2) this.fail('Numeric literal expected.', start)
    } else {
      if (text[start] === '0' && isDigit(text[start + 1])) this.fail('Octal literals are not allowed.', start)
      digits(isDigit)
      if (text[index] === '.') {
        index += 1
        digits(isDigit)
      }
      if (text[index] === 'e' || text[index] === 'E') {
        index += 1
        if (text[index] === '+' || text[index] === '-') index += 1
        if (!isDigit(text[index])) this.fail('Digit expected.', index)
        digits(isDigit)
      }
    }
    if (text[index] === 'n') index += 1
    if (isIdentifierStart(text[index]) || isDigit(text[index]))
      this.fail('An identifier or keyword cannot immediately follow a numeric literal.', index)
    return index
  }

  /**
   * The end of the string starting at an offset.
   *
   * @param start - The opening quote
   * @param quote - Which quote
   * @returns The offset after the closing quote
   */
  private stringEnd(start: number, quote: string): number {
    const text = this.text
    let index = start + 1
    for (;;) {
      const char = text[index]
      if (char === undefined || char === '\n' || char === '\r') this.fail('Unterminated string literal.', start)
      if (char === '\\') index += text[index + 1] === '\r' && text[index + 2] === '\n' ? 3 : 2
      else if (char === quote) return index + 1
      else index += 1
    }
  }
}

/**
 * The name a token spells, Unicode escapes decoded.
 *
 * @param raw - The name as written
 * @returns The name as read
 */
function decodeName(raw: string): string {
  return raw.includes('\\')
    ? raw.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, braced: string | undefined, plain: string | undefined) =>
        fromCodePoint(parseInt(braced ?? plain ?? '0', 16))
      )
    : raw
}

/**
 * The category a token falls in when compared with another scanner.
 *
 * @param kind - The token's kind
 * @returns `word`, `number`, `string`, `template`, `regex`, `jsxtext` or `punct`
 */
export function categoryOf(kind: TokenKind): string {
  return kind === 'name' || kind === 'private' ? 'word' : kind
}
