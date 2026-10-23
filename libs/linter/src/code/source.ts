/**
 * What rules ask of the source around a node: the tokens and comments before, after and
 * between positions, and whether a node sits in parentheses.
 *
 * @module code/source
 */

import type { SourceComment } from '../config/directives'
import type { RuleFile } from '../engine/rule'
import type { Node, SourceToken } from './model'

/**
 * The index of the first token starting at or after an offset.
 *
 * @param tokens - The program's tokens, in source order
 * @param offset - The offset searched from
 * @returns The index, or the token count when none starts there or later
 */
function indexFrom(tokens: readonly SourceToken[], offset: number): number {
  let low = 0
  let high = tokens.length
  while (low < high) {
    const middle = (low + high) >> 1
    if ((tokens[middle] as SourceToken).start < offset) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * The last token ending at or before an offset.
 *
 * @param program - The program whose tokens are searched
 * @param offset - The offset searched back from
 * @returns The token, or null when none ends before it
 *
 * @example Find the token before a node
 * ```ts
 * // file.text: 'const total = (price) * 2', price: its Identifier node
 * const open = tokenBefore(program, price.start)
 * tokenText(file, open) // => '('
 * tokenBefore(program, 0) // => null
 * ```
 */
export function tokenBefore(program: Node, offset: number): SourceToken | null {
  const tokens = program.tokens as readonly SourceToken[]
  let index = indexFrom(tokens, offset) - 1
  while (index >= 0 && (tokens[index] as SourceToken).end > offset) index -= 1
  return index >= 0 ? (tokens[index] as SourceToken) : null
}

/**
 * The first token starting at or after an offset.
 *
 * @param program - The program whose tokens are searched
 * @param offset - The offset searched from
 * @returns The token, or null when none starts there or later
 *
 * @example Find the token after a node
 * ```ts
 * // file.text: 'const total = (price) * 2', price: its Identifier node
 * tokenText(file, tokenAfter(program, price.end)) // => ')'
 * tokenAfter(program, file.text.length) // => null
 * ```
 */
export function tokenAfter(program: Node, offset: number): SourceToken | null {
  const tokens = program.tokens as readonly SourceToken[]
  return tokens[indexFrom(tokens, offset)] ?? null
}

/**
 * The tokens starting at or after one offset and ending at or before another.
 *
 * @param program - The program whose tokens are searched
 * @param start - The first offset
 * @param end - The last offset
 * @returns The tokens, in source order
 *
 * @example List the tokens a node spans
 * ```ts
 * // file.text: 'const total = (price) * 2', init: the BinaryExpression
 * const tokens = tokensBetween(program, init.start, init.end)
 * tokens.map((token) => tokenText(file, token))
 * // => ['(', 'price', ')', '*', '2']
 * ```
 */
export function tokensBetween(program: Node, start: number, end: number): SourceToken[] {
  const tokens = program.tokens as readonly SourceToken[]
  const found: SourceToken[] = []
  for (let index = indexFrom(tokens, start); index < tokens.length && (tokens[index] as SourceToken).end <= end; index += 1) {
    found.push(tokens[index] as SourceToken)
  }
  return found
}

/**
 * The comments starting at or after one offset and ending at or before another.
 *
 * @param file - The file linted
 * @param start - The first offset
 * @param end - The last offset
 * @returns The comments, in source order
 *
 * @example Find the comments inside a range
 * ```ts
 * // file.text: 'const total = price * 2 // doubled'
 * commentsBetween(file, 0, file.text.length)
 * // => [{ start: 24, end: 34, text: ' doubled', ... }]
 * ```
 */
export function commentsBetween(file: RuleFile, start: number, end: number): SourceComment[] {
  return file.comments.filter((comment) => comment.start >= start && comment.end <= end)
}

/**
 * Whether a node sits directly between an opening and a closing parenthesis.
 *
 * @param program - The program whose tokens are searched
 * @param file - The file linted
 * @param node - The node looked around
 * @returns Whether the tokens around it are parentheses
 *
 * @example Tell a wrapped operand from its expression
 * ```ts
 * // file.text: 'const total = (price) * 2'
 * isParenthesised(program, file, price) // => true
 * isParenthesised(program, file, init) // => false (the whole BinaryExpression)
 * ```
 */
export function isParenthesised(program: Node, file: RuleFile, node: Node): boolean {
  const before = tokenBefore(program, node.start)
  const after = tokenAfter(program, node.end)
  return before !== null && after !== null && file.text[before.start] === '(' && file.text[after.start] === ')'
}

/**
 * The text of a token.
 *
 * @param file - The file linted
 * @param token - The token read
 * @returns Its characters
 *
 * @example Read a token's characters
 * ```ts
 * // file.text: 'const total = 2'
 * tokenText(file, program.tokens[1]) // => 'total'
 * ```
 */
export function tokenText(file: RuleFile, token: SourceToken): string {
  return file.text.slice(token.start, token.end)
}
