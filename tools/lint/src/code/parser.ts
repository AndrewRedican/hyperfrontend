/**
 * The parser's state and primitives: the current token, consumption that records every token
 * for the scanner comparison, lookahead and speculation with full rewind, node construction,
 * identifiers, and automatic semicolon insertion. The grammar itself lives in the `parse-*`
 * modules, which read and advance this state.
 *
 * @module code/parser
 */

import type { Draft, Kind, Node, SourceToken } from './model.ts'
import type { Token } from './scanner.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { RESERVED } from './scanner-tables.ts'
import { Scanner, SyntaxFailure, categoryOf } from './scanner.ts'

/** Where the parser was, for speculation. */
interface ParserState {
  /** The scanner's state. */
  readonly scanner: ReturnType<Scanner['save']>
  /** How many tokens had been recorded. */
  readonly tokens: number
  /** The end of the last consumed token. */
  readonly lastEnd: number
  /** Whether a generator body was open. */
  readonly inGenerator: boolean
  /** Whether an async body was open. */
  readonly inAsync: boolean
  /** Whether `in` was disallowed. */
  readonly noIn: boolean
}

/** How the next token is scanned. */
export type ScanMode = 'normal' | 'jsxChild' | 'jsxName' | 'jsxAttribute'

/** The parser's state. */
export class Parser {
  /** The scanner the parser reads tokens from. */
  readonly scanner: Scanner
  /** The source text. */
  readonly text: string
  /** Whether JSX is allowed. */
  readonly jsx: boolean
  /** Whether the text is a non-strict script, whose strings may hold legacy octal escapes. */
  readonly sloppy: boolean
  /** Every token consumed, in order. */
  readonly tokens: SourceToken[] = []
  /** The offset after the last consumed token. */
  lastEnd = 0
  /** Whether a generator body is open, so `yield` is a keyword. */
  inGenerator = false
  /** Whether an async body is open, so `await` is a keyword. */
  inAsync = false
  /** Whether `in` is disallowed as a binary operator, inside a for statement's head. */
  noIn = false
  /** Whether the statements being parsed sit in an ambient declaration, where nothing is initialised or implemented. */
  ambient = false
  /** The arrow functions tried and failed, by offset and context, which fail again the same way and are not retried. */
  readonly failedArrows = createSet<string>()

  /**
   * Creates a parser at the first token of a text.
   *
   * @param text - The source text
   * @param extension - The file's extension with its dot, which decides the dialect
   * @param sloppy - Whether the text is a non-strict script
   * @param declaration - Whether the text is a declaration file, ambient throughout
   */
  constructor(text: string, extension: string, sloppy = false, declaration = false) {
    this.text = text
    this.sloppy = sloppy
    this.ambient = declaration
    // why: the compiler parses every file with the TypeScript grammar and reports type syntax in JavaScript only when checking; the old parser did the same, so the extension only decides whether JSX is allowed.
    this.jsx = extension !== '.ts' && extension !== '.mts' && extension !== '.cts'
    this.scanner = new Scanner(text)
    this.scanner.scan()
  }

  /**
   * The current token, which the scanner has read but the parser not yet consumed.
   *
   * @returns What the scanner read last
   */
  get token(): Token {
    return this.scanner.token
  }

  /**
   * Consumes the current token and scans the next.
   *
   * @param mode - How the next token is scanned
   * @returns The token consumed
   */
  next(mode: ScanMode = 'normal'): Token {
    const consumed = this.token
    if (consumed.kind !== 'eof') this.tokens.push({ category: categoryOf(consumed.kind), start: consumed.start, end: consumed.end })
    this.lastEnd = consumed.end
    if (mode === 'jsxChild') this.scanner.scanJsxChild()
    else if (mode === 'jsxAttribute') this.scanner.scanJsxAttribute()
    else this.scanner.scan()
    if (mode === 'jsxName' && this.token.kind === 'name') this.scanner.scanJsxName()
    return consumed
  }

  /**
   * Whether the current token is a punctuator.
   *
   * @param punct - The punctuator
   * @returns True when it is
   */
  is(punct: string): boolean {
    return this.token.kind === 'punct' && this.token.value === punct
  }

  /**
   * Whether the current token is a word.
   *
   * @param word - The word looked for
   * @returns True when it is
   */
  isWord(word: string): boolean {
    return this.token.kind === 'name' && this.token.value === word
  }

  /**
   * Consumes a punctuator when it is the current token.
   *
   * @param punct - The punctuator
   * @returns True when it was consumed
   */
  eat(punct: string): boolean {
    if (!this.is(punct)) return false
    this.next()
    return true
  }

  /**
   * Consumes a word when it is the current token.
   *
   * @param word - The word looked for
   * @returns True when it was consumed
   */
  eatWord(word: string): boolean {
    if (!this.isWord(word)) return false
    this.next()
    return true
  }

  /**
   * Consumes a punctuator, or fails.
   *
   * @param punct - The punctuator
   * @param mode - How the next token is scanned
   */
  expect(punct: string, mode: ScanMode = 'normal'): void {
    if (!this.is(punct)) this.fail(`'${punct}' expected.`)
    this.next(mode)
  }

  /**
   * Consumes a word, or fails.
   *
   * @param word - The word looked for
   */
  expectWord(word: string): void {
    if (!this.isWord(word)) this.fail(`'${word}' expected.`)
    this.next()
  }

  /**
   * Throws a parse error.
   *
   * @param message - What was wrong
   * @param offset - Where, the current token by default
   */
  fail(message: string, offset = this.token.start): never {
    throw new SyntaxFailure(message, offset)
  }

  /**
   * Where the parser is.
   *
   * @returns The state
   */
  save(): ParserState {
    return {
      scanner: this.scanner.save(),
      tokens: this.tokens.length,
      lastEnd: this.lastEnd,
      inGenerator: this.inGenerator,
      inAsync: this.inAsync,
      noIn: this.noIn,
    }
  }

  /**
   * Returns to a saved state.
   *
   * @param state - What `save` answered
   */
  restore(state: ParserState): void {
    this.scanner.restore(state.scanner)
    this.tokens.length = state.tokens
    this.lastEnd = state.lastEnd
    this.inGenerator = state.inGenerator
    this.inAsync = state.inAsync
    this.noIn = state.noIn
  }

  /**
   * The token after the current one.
   *
   * @returns The next token, without consuming anything
   */
  peek(): Token {
    const state = this.save()
    this.scanner.scan()
    const token = this.token
    this.restore(state)
    return token
  }

  /**
   * Runs a parse and rewinds whether or not it succeeds.
   *
   * @param parse - What to try
   * @returns What it answered, or null when it failed
   */
  lookahead<T>(parse: () => T): T | null {
    const state = this.save()
    const result = this.tryParse(parse)
    this.restore(state)
    return result
  }

  /**
   * Runs a parse, rewinding only when it fails.
   *
   * @param parse - What to try
   * @returns What it answered, or null when it failed
   */
  tryParse<T>(parse: () => T): T | null {
    const state = this.save()
    try {
      return parse()
    } catch (error) {
      // why: the grammar throws nothing but syntax failures; anything else is a defect to surface.
      /* node:coverage ignore next 1 */
      if (!(error instanceof SyntaxFailure)) throw error
      this.restore(state)
      return null
    }
  }

  /**
   * Builds a node ending at the last consumed token.
   *
   * @param kind - The node kind to build
   * @param start - The offset of the first character
   * @param fields - The kind's fields
   * @returns The node built
   */
  node(kind: Kind, start: number, fields: Omit<Draft, 'kind' | 'start' | 'end' | 'parent'> = {}): Node {
    return { kind, start, end: this.lastEnd, parent: null, ...fields } as Node
  }

  /**
   * Whether a token can be an identifier.
   *
   * @param token - The token to inspect
   * @returns True for a word that is not reserved
   */
  isIdentifier(token: Token = this.token): boolean {
    // why: words reserved only in strict mode, such as `public` or `static`, are identifiers to the parser; the compiler reports their use when checking.
    if (token.kind !== 'name' || RESERVED.has(token.value)) return false
    if (token.value === 'yield') return !this.inGenerator
    if (token.value === 'await') return !this.inAsync
    return true
  }

  /**
   * Parses an identifier.
   *
   * @returns The identifier node
   */
  identifier(): Node {
    if (!this.isIdentifier()) this.fail('Identifier expected.')
    const token = this.next()
    return this.node('Identifier', token.start, { name: token.value })
  }

  /**
   * Parses a property name, where any word is allowed.
   *
   * @returns The identifier node
   */
  propertyName(): Node {
    if (this.token.kind !== 'name') this.fail('Identifier expected.')
    const token = this.next()
    return this.node('Identifier', token.start, { name: token.value })
  }

  /**
   * Ends a statement: a semicolon, or one inserted before a closing brace, the end of the text or
   * a line break.
   */
  semicolon(): void {
    if (this.eat(';')) return
    if (this.is('}') || this.token.kind === 'eof' || this.token.newlineBefore) return
    this.fail("';' expected.")
  }

  /**
   * Whether the current token is a word followed, on the same line, by something that makes it
   * a modifier or a contextual keyword rather than an identifier.
   *
   * @param word - The word looked for
   * @param follows - Whether the token after qualifies
   * @returns True when the word is followed that way
   */
  isWordFollowedBy(word: string, follows: (token: Token) => boolean): boolean {
    if (!this.isWord(word)) return false
    const after = this.peek()
    return !after.newlineBefore && follows(after)
  }
}

/**
 * Whether a token starts a binding: a name, `[` or `{`.
 *
 * @param token - The token to inspect
 * @returns True when it does
 */
export function startsBinding(token: Token): boolean {
  return token.kind === 'name' || (token.kind === 'punct' && (token.value === '[' || token.value === '{'))
}
