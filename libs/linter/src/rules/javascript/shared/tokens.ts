/**
 * Comparing nodes by what is written: two nodes are the same when their tokens are, whatever the
 * spacing and comments between them.
 *
 * @module rules/javascript/shared/tokens
 */

import type { Node, SourceToken } from '../../../code/model'
import type { RuleFile } from '../../../engine/rule'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { tokensBetween, tokenText } from '../../../code/source'

/**
 * Whether two nodes are written with the same tokens.
 *
 * @param program - The program whose tokens are compared
 * @param file - The file linted
 * @param a - One node
 * @param b - Another
 * @returns Whether every token of one matches the token of the other at the same place
 *
 * @example Compare two operands, ignoring spacing and comments
 * ```ts
 * // spaced: limit + // the cap
 * //           1
 * // compact: limit+1
 * // other: limit + 2
 * sameTokens(program, file, spaced, compact) // => true
 * sameTokens(program, file, compact, other) // => false
 * ```
 */
export function sameTokens(program: Node, file: RuleFile, a: Node, b: Node): boolean {
  const left = tokensBetween(program, a.start, a.end)
  const right = tokensBetween(program, b.start, b.end)
  return (
    left.length === right.length &&
    left.every((token, index) => {
      const other = right[index] as SourceToken
      return token.category === other.category && tokenText(file, token) === tokenText(file, other)
    })
  )
}

/**
 * A node's tokens as one text: two nodes have the same key exactly when `sameTokens` holds for them.
 *
 * @param program - The program whose tokens are read
 * @param file - The file linted
 * @param node - The node keyed
 * @returns The categories and texts of its tokens, encoded so that no two token lists share a key
 *
 * @example Collect the labels of a switch without comparing each pair
 * ```ts
 * // case limit + 1: ... case limit+1:
 * tokenKey(program, file, first) === tokenKey(program, file, second) // => true
 * ```
 */
export function tokenKey(program: Node, file: RuleFile, node: Node): string {
  return stringify(tokensBetween(program, node.start, node.end).map((token) => [token.category, tokenText(file, token)]))
}
