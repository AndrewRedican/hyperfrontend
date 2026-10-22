/**
 * `-0` compares equal to `0` under every relational operator, so comparing against it never tells
 * the two apart; `Object.is(x, -0)` does.
 *
 * @module rules/javascript/no-compare-neg-zero
 */

import type { Node } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'

/** The operators that compare two values. */
const COMPARISONS = createSet<string>(['==', '===', '!=', '!==', '<', '<=', '>', '>='])

export default defineRule<undefined, Node>({
  id: 'no-compare-neg-zero',
  language: 'code',
  fixable: false,
  create: (context) => ({
    BinaryExpression(node) {
      const operator = node.operator as string
      if (!COMPARISONS.has(operator) || !(isNegativeZero(node.left as Node) || isNegativeZero(node.right as Node))) return
      context.report({ start: node.start, end: node.end, message: `Do not use the '${operator}' operator to compare against -0.` })
    },
  }),
})

/**
 * Whether an expression is a minus applied to a zero number literal, in any spelling of zero.
 *
 * @param node - The operand tested
 * @returns Whether it evaluates to `-0`
 */
function isNegativeZero(node: Node): boolean {
  if (node.kind !== 'UnaryExpression' || node.operator !== '-') return false
  const argument = node.argument as Node
  return argument.kind === 'Literal' && argument.value === 0
}
