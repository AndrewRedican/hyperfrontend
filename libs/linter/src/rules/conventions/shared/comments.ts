/**
 * How the workspace rules tell comments apart: a line comment, a plain block comment or a JSDoc
 * block, read from the character after the opening slash and the first character of the text.
 *
 * @module rules/conventions/shared/comments
 */

import type { SourceComment } from '../../../config/directives'
import type { RuleFile } from '../../../engine/rule'

/** What a comment is. */
export type CommentKind = 'line' | 'block' | 'jsdoc'

/**
 * Which kind of comment one is: `line` for `//`, `jsdoc` for a block opening with `/**`, `block` otherwise.
 *
 * @param file - The file linted
 * @param comment - The comment classified
 * @returns Its kind
 *
 * @example Classify each comment a file holds
 * ```ts
 * // file.text: 'const port = 80 // why: the default\n/* legacy *\/\n/** Docs. *\/'
 * file.comments.map((comment) => commentKind(file, comment))
 * // => ['line', 'block', 'jsdoc']
 * ```
 */
export function commentKind(file: RuleFile, comment: SourceComment): CommentKind {
  if (file.text[comment.start + 1] !== '*') return 'line'
  return comment.text.startsWith('*') ? 'jsdoc' : 'block'
}

/**
 * Whether a comment is a line comment.
 *
 * @param file - The file linted
 * @param comment - The comment classified
 * @returns True for `//`
 *
 * @example Keep only the line comments
 * ```ts
 * // file.text: 'const port = 80 // why: the default\n/* legacy *\/'
 * file.comments.filter((comment) => isLineComment(file, comment))
 * // => [{ start: 16, end: 35, text: ' why: the default' }]
 * ```
 */
export function isLineComment(file: RuleFile, comment: SourceComment): boolean {
  return commentKind(file, comment) === 'line'
}

/**
 * Whether a comment is a JSDoc block.
 *
 * @param file - The file linted
 * @param comment - The comment classified
 * @returns True for a block opening with `/**`
 *
 * @example Tell a JSDoc block from a plain block
 * ```ts
 * // file.text: '/* legacy *\/\n/** Docs. *\/'
 * file.comments.map((comment) => isJsdocComment(file, comment))
 * // => [false, true]
 * ```
 */
export function isJsdocComment(file: RuleFile, comment: SourceComment): boolean {
  return commentKind(file, comment) === 'jsdoc'
}

/**
 * Whether a comment sits alone on its line: only whitespace before it on that line.
 *
 * @param file - The file linted
 * @param comment - The comment placed
 * @returns True when nothing but whitespace precedes it on its line
 *
 * @example Tell a trailing comment from one on its own line
 * ```ts
 * // file.text: 'const port = 80 // why: the default\n  /** Docs. *\/'
 * file.comments.map((comment) => isOwnLine(file, comment))
 * // => [false, true]
 * ```
 */
export function isOwnLine(file: RuleFile, comment: SourceComment): boolean {
  let index = comment.start - 1
  while (index >= 0 && (file.text[index] === ' ' || file.text[index] === '\t')) index -= 1
  return index < 0 || file.text[index] === '\n'
}
