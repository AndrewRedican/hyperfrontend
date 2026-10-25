/**
 * A JSON parser that keeps positions: every object, array, property and literal records where it
 * starts and ends in the text, so a tool can report on, or edit, one part of a document. Line and
 * block comments and trailing commas are accepted, as editors and configuration files allow them,
 * and the comments are returned with their positions. A malformed document is reported with the
 * offset where parsing stopped; only a document nested deeper than the platform's call stack throws.
 *
 * @module parse/parse-json
 */

import { parseFloat, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { fromCharCode } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'

/** A range of the parsed text: the offset of its first character and the offset after its last. */
export interface JsonSpan {
  /** The offset of the first character. */
  readonly start: number
  /** The offset after the last character. */
  readonly end: number
}

/** A string, number, boolean or null. */
export interface JsonLiteralNode extends JsonSpan {
  /** Which literal it is. */
  readonly kind: 'string' | 'number' | 'boolean' | 'null'
  /** The parsed value. */
  readonly value: string | number | boolean | null
  /** The text as written, quotes and escapes included. */
  readonly raw: string
}

/** One `"key": value` pair of an object. */
export interface JsonPropertyNode extends JsonSpan {
  /** Marks the node as a property. */
  readonly kind: 'property'
  /** The key, always a string literal. */
  readonly key: JsonLiteralNode
  /** The value. */
  readonly value: JsonNode
}

/** A brace-delimited list of properties. */
export interface JsonObjectNode extends JsonSpan {
  /** Marks the node as an object. */
  readonly kind: 'object'
  /** The properties in source order. */
  readonly properties: readonly JsonPropertyNode[]
}

/** A bracket-delimited list of values. */
export interface JsonArrayNode extends JsonSpan {
  /** Marks the node as an array. */
  readonly kind: 'array'
  /** The elements in source order. */
  readonly elements: readonly JsonNode[]
}

/** Any value. */
export type JsonNode = JsonObjectNode | JsonArrayNode | JsonLiteralNode

/** Why parsing stopped. */
export interface JsonParseError {
  /** What was wrong. */
  readonly message: string
  /** The offset where parsing stopped. */
  readonly offset: number
}

/** What parsing produced. */
export interface JsonParseResult {
  /** The document's value, or null when it could not be parsed. */
  readonly root: JsonNode | null
  /** The comments found, in source order. */
  readonly comments: readonly JsonSpan[]
  /** The error, or null when the document parsed. */
  readonly error: JsonParseError | null
}

/** The failure the parser throws, which `parseJsonSource` turns into its result. */
class ParseFailure {
  /** What was wrong. */
  readonly message: string
  /** The offset where parsing stopped. */
  readonly offset: number

  /**
   * Records why parsing stopped.
   *
   * @param message - What was wrong
   * @param offset - The offset where parsing stopped
   */
  constructor(message: string, offset: number) {
    this.message = message
    this.offset = offset
  }
}

/** The parser's position in the text. */
interface State {
  /** The text being parsed. */
  readonly text: string
  /** The offset of the next character to read. */
  index: number
  /** The comments found so far. */
  readonly comments: JsonSpan[]
}

/**
 * Parses a JSON document, keeping the position of every node.
 *
 * @example Reading a manifest's `exports` with positions
 * ```typescript
 * import { parseJsonSource } from '@hyperfrontend/json-utils'
 *
 * const result = parseJsonSource('{ "name": "demo", "exports": { ".": "./index.js" } }')
 * if (result.root?.kind === 'object') {
 *   const exportsProperty = result.root.properties.find((property) => property.key.value === 'exports')
 *   // exportsProperty.start and exportsProperty.end delimit `"exports": { ... }` in the text
 * }
 * ```
 * @param text - The document, with or without comments and trailing commas
 * @returns The root node and the comments, or the error that stopped parsing
 */
export function parseJsonSource(text: string): JsonParseResult {
  const state: State = { text, index: 0, comments: [] }
  try {
    skipTrivia(state)
    const root = parseValue(state)
    skipTrivia(state)
    if (state.index < text.length) fail(state, 'Unexpected content after the document')
    return { root, comments: state.comments, error: null }
  } catch (error) {
    // why: the parser throws nothing but its own failures; anything else, a stack overflow on a document nested beyond the platform's depth included, is not a parse error to report.
    if (!(error instanceof ParseFailure)) throw error
    return { root: null, comments: state.comments, error: freeze({ message: error.message, offset: error.offset }) }
  }
}

/**
 * Stops parsing.
 *
 * @param state - The parser, whose index becomes the error's offset
 * @param message - What was wrong
 * @throws {ParseFailure} Always; `parseJsonSource` turns it into its result
 */
function fail(state: State, message: string): never {
  throw new ParseFailure(message, state.index)
}

/**
 * Skips whitespace and comments, recording the comments.
 *
 * @param state - The parser, advanced past the trivia
 */
function skipTrivia(state: State): void {
  const { text } = state
  while (state.index < text.length) {
    const char = text[state.index]
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      state.index += 1
    } else if (char === '/' && text[state.index + 1] === '/') {
      const start = state.index
      const lineEnd = text.indexOf('\n', start)
      state.index = lineEnd === -1 ? text.length : lineEnd
      state.comments.push({ start, end: state.index })
    } else if (char === '/' && text[state.index + 1] === '*') {
      const start = state.index
      const close = text.indexOf('*/', start + 2)
      if (close === -1) fail(state, 'Unterminated block comment')
      state.index = close + 2
      state.comments.push({ start, end: state.index })
    } else {
      return
    }
  }
}

/**
 * Parses one value at the current position.
 *
 * @param state - The parser, positioned at the value's first character
 * @returns The node
 */
function parseValue(state: State): JsonNode {
  const char = state.text[state.index]
  if (char === '{') return parseObject(state)
  if (char === '[') return parseArray(state)
  if (char === '"') return parseString(state)
  if (char === '-' || (char !== undefined && char >= '0' && char <= '9')) return parseNumber(state)
  if (char === 't') return parseWord(state, 'true', 'boolean', true)
  if (char === 'f') return parseWord(state, 'false', 'boolean', false)
  if (char === 'n') return parseWord(state, 'null', 'null', null)
  return fail(state, char === undefined ? 'Unexpected end of document' : `Unexpected character ${char}`)
}

/**
 * Parses an object at the current position.
 *
 * @param state - The parser, positioned at the `{`
 * @returns The object node
 */
function parseObject(state: State): JsonObjectNode {
  const start = state.index
  state.index += 1
  const properties: JsonPropertyNode[] = []
  skipTrivia(state)
  while (state.text[state.index] !== '}') {
    if (state.text[state.index] !== '"') fail(state, 'Expected a property name')
    const key = parseString(state)
    skipTrivia(state)
    if (state.text[state.index] !== ':') fail(state, 'Expected a colon after the property name')
    state.index += 1
    skipTrivia(state)
    const value = parseValue(state)
    properties.push({ kind: 'property', key, value, start: key.start, end: value.end })
    skipTrivia(state)
    if (state.text[state.index] === ',') {
      state.index += 1
      skipTrivia(state)
    } else if (state.text[state.index] !== '}') {
      fail(state, 'Expected a comma or a closing brace')
    }
  }
  state.index += 1
  return { kind: 'object', properties, start, end: state.index }
}

/**
 * Parses an array at the current position.
 *
 * @param state - The parser, positioned at the `[`
 * @returns The array node
 */
function parseArray(state: State): JsonArrayNode {
  const start = state.index
  state.index += 1
  const elements: JsonNode[] = []
  skipTrivia(state)
  while (state.text[state.index] !== ']') {
    elements.push(parseValue(state))
    skipTrivia(state)
    if (state.text[state.index] === ',') {
      state.index += 1
      skipTrivia(state)
    } else if (state.text[state.index] !== ']') {
      fail(state, 'Expected a comma or a closing bracket')
    }
  }
  state.index += 1
  return { kind: 'array', elements, start, end: state.index }
}

/**
 * Parses a string literal at the current position.
 *
 * @param state - The parser, positioned at the opening quote
 * @returns The string node
 */
function parseString(state: State): JsonLiteralNode {
  const { text } = state
  const start = state.index
  let value = ''
  state.index += 1
  while (true) {
    const char = text[state.index]
    if (char === undefined) fail(state, 'Unterminated string')
    if (char === '"') break
    if (char < ' ') fail(state, 'Control character in a string')
    if (char === '\\') {
      value += parseEscape(state)
    } else {
      value += char
      state.index += 1
    }
  }
  state.index += 1
  return { kind: 'string', value, raw: text.slice(start, state.index), start, end: state.index }
}

/** The characters the single-character escapes stand for. */
const ESCAPES: Readonly<Record<string, string>> = freeze({ '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' })

/**
 * Parses one escape sequence inside a string.
 *
 * @param state - The parser, positioned at the backslash
 * @returns The character the escape stands for
 */
function parseEscape(state: State): string {
  const { text } = state
  const marker = text[state.index + 1]
  if (marker === 'u') {
    const digits = text.slice(state.index + 2, state.index + 6)
    if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail(state, 'Invalid unicode escape')
    state.index += 6
    return fromCharCode(parseInt(digits, 16))
  }
  const simple = marker === undefined ? undefined : ESCAPES[marker]
  if (simple === undefined) fail(state, 'Invalid escape sequence')
  state.index += 2
  return simple
}

/**
 * Parses a number at the current position.
 *
 * @param state - The parser, positioned at the sign or first digit
 * @returns The number node
 */
function parseNumber(state: State): JsonLiteralNode {
  const { text } = state
  const start = state.index
  let index = text[start] === '-' ? start + 1 : start
  if (text[index] === '0') index += 1
  else if (isDigit(text[index])) index = skipDigits(text, index)
  else fail(state, 'Invalid number')
  if (text[index] === '.' && isDigit(text[index + 1])) index = skipDigits(text, index + 1)
  if (text[index] === 'e' || text[index] === 'E') {
    const afterSign = text[index + 1] === '+' || text[index + 1] === '-' ? index + 2 : index + 1
    if (isDigit(text[afterSign])) index = skipDigits(text, afterSign)
  }
  const raw = text.slice(start, index)
  state.index = index
  return { kind: 'number', value: parseFloat(raw), raw, start, end: index }
}

/**
 * Whether a character is a decimal digit.
 *
 * @param char - The character, or undefined at the end of the text
 * @returns True for `0` to `9`
 */
function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9'
}

/**
 * The offset after a run of digits.
 *
 * @param text - The document being parsed
 * @param index - The offset of the run's first digit
 * @returns The offset of the first character that is no digit
 */
function skipDigits(text: string, index: number): number {
  let end = index
  while (isDigit(text[end])) end += 1
  return end
}

/**
 * Parses one of the literal words `true`, `false` and `null`.
 *
 * @param state - The parser, positioned at the word's first character
 * @param word - The word expected
 * @param kind - The node kind the word denotes
 * @param value - The value the word denotes
 * @returns The literal node
 */
function parseWord(state: State, word: string, kind: 'boolean' | 'null', value: boolean | null): JsonLiteralNode {
  const start = state.index
  if (!state.text.startsWith(word, start)) fail(state, `Unexpected character ${state.text[start]}`)
  state.index = start + word.length
  return { kind, value, raw: word, start, end: state.index }
}
