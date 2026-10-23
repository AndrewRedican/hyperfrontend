/**
 * The code parser's entry: a text and its extension in, the tree with every parent set, the
 * comments and the consumed tokens out, or the one parse error that stopped it.
 *
 * @module code/parse
 */

import type { LanguageSettings } from '../config/model'
import type { Draft, Node, SourceToken } from './model'
import type { Comment } from './scanner'
import { setParents } from './children'
import { parseProgram } from './parse-statements'
import { Parser } from './parser'
import { SyntaxFailure } from './scanner'

/** How a text is read as a module or a script. */
export type SourceType = LanguageSettings['sourceType']

/** Why a text did not parse. */
export interface ParseError {
  /** What was wrong. */
  readonly message: string
  /** The offset where it was found. */
  readonly offset: number
}

/** What parsing a text produced. */
export interface ParsedCode {
  /** The program, or null when the text did not parse. */
  readonly tree: Node | null
  /** The comments found, in source order. */
  readonly comments: readonly Comment[]
  /** The tokens consumed, in source order. */
  readonly tokens: readonly SourceToken[]
  /** The error that stopped parsing, or null. */
  readonly error: ParseError | null
}

/**
 * Parses a code file.
 *
 * @param text - The source text
 * @param extension - The file's extension with its dot
 * @param sourceType - Whether the text is a module, a script or a CommonJS module; a script's strings may hold legacy escapes
 * @param declaration - Whether the text is a declaration file, where declarations need no initialiser or body
 * @returns The tree, comments and tokens, or the error
 *
 * @example Parse a file, or read why it did not parse
 * ```ts
 * const parsed = parseCode('const total = price * 2 // doubled', '.ts')
 * parsed.tree.kind // => 'Program'
 * parsed.comments[0].text // => ' doubled'
 *
 * parseCode('const = 1', '.ts').error
 * // => { message: 'Identifier expected.', offset: 6 }
 * ```
 */
export function parseCode(text: string, extension: string, sourceType: SourceType = 'module', declaration = false): ParsedCode {
  let parser: Parser | null = null
  try {
    parser = new Parser(text, extension, sourceType !== 'module', declaration)
    const tree = parseProgram(parser)
    setParents(tree)
    ;(tree as Draft).tokens = parser.tokens
    return { tree, comments: parser.scanner.comments, tokens: parser.tokens, error: null }
  } catch (error) {
    // why: the parser throws nothing but syntax failures; anything else is a defect to surface, not a parse error to report.
    /* node:coverage ignore next 1 */
    if (!(error instanceof SyntaxFailure)) throw error
    return {
      tree: null,
      comments: parser?.scanner.comments ?? [],
      tokens: parser?.tokens ?? [],
      error: { message: error.message, offset: error.offset },
    }
  }
}

/** A comment as the scanner comparison reads it. */
export interface ScannedComment {
  /** The offset of the slash. */
  readonly start: number
  /** The offset after the comment. */
  readonly end: number
  /** True for a block comment. */
  readonly block: boolean
}

/** What the scanner comparison reads. */
export interface Scan {
  /** The tokens consumed, in source order. */
  readonly tokens: readonly SourceToken[]
  /** The comments found, in source order. */
  readonly comments: readonly ScannedComment[]
  /** The parse error's message, or null when the text parses. */
  readonly error: string | null
}

/**
 * Scans a text as the comparison with the compiler reads it: by parsing it.
 *
 * @param text - The source text
 * @param extension - The file's extension with its dot
 * @returns The tokens, comments and verdict
 *
 * @example Scan a text into tokens, comments and a verdict
 * ```ts
 * const result = scan('let id = 1 // first', '.ts')
 * result.tokens.map((token) => token.category)
 * // => ['word', 'word', 'punct', 'number']
 * result.comments // => [{ start: 11, end: 19, block: false }]
 * scan('const = 1', '.ts').error // => 'Identifier expected. (6)'
 * ```
 */
export function scan(text: string, extension: string): Scan {
  const parsed = parseCode(text, extension)
  return {
    tokens: parsed.tokens,
    comments: parsed.comments.map((comment) => ({ start: comment.start, end: comment.end, block: comment.block })),
    error: parsed.error === null ? null : `${parsed.error.message} (${parsed.error.offset})`,
  }
}
