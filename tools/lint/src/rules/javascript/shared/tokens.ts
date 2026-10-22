/**
 * Comparing nodes by what is written: two nodes are the same when their tokens are, whatever the
 * spacing and comments between them.
 *
 * @module rules/javascript/shared/tokens
 */

import type { Node, SourceToken } from '../../../code/model.ts'
import type { RuleFile } from '../../../engine/rule.ts'
import { tokensBetween, tokenText } from '../../../code/source.ts'

/**
 * Whether two nodes are written with the same tokens.
 *
 * @param program - The program whose tokens are compared
 * @param file - The file linted
 * @param a - One node
 * @param b - Another
 * @returns Whether every token of one matches the token of the other at the same place
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
