/**
 * How the workspace rules tell comments apart: a line comment, a plain block comment or a JSDoc
 * block, read from the character after the opening slash and the first character of the text.
 *
 * @module rules/workspace/shared/comments
 */

import type { SourceComment } from '../../../config/directives.ts'
import type { RuleFile } from '../../../engine/rule.ts'

/** What a comment is. */
export type CommentKind = 'line' | 'block' | 'jsdoc'

/**
 * Which kind of comment one is: `line` for `//`, `jsdoc` for a block opening with `/**`, `block` otherwise.
 *
 * @param file - The file linted
 * @param comment - The comment classified
 * @returns Its kind
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
 */
export function isOwnLine(file: RuleFile, comment: SourceComment): boolean {
  let index = comment.start - 1
  while (index >= 0 && (file.text[index] === ' ' || file.text[index] === '\t')) index -= 1
  return index < 0 || file.text[index] === '\n'
}
