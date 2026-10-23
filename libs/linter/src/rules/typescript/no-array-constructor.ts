/**
 * `Array(x, y)` and `new Array()` build what a literal spells out; only the one-argument form
 * sets a length, so it stays. A call with type arguments stays too, as a literal cannot carry
 * them. The construction is replaced by a literal holding the argument text.
 *
 * @module rules/typescript/no-array-constructor
 */

import type { Node, SourceToken } from '../../code/model'
import { tokensBetween } from '../../code/source'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'typescript/no-array-constructor',
  language: 'code',
  fixable: true,
  create(context) {
    const check = (node: Node): void => {
      const callee = node.callee as Node
      const args = node.arguments as readonly Node[]
      if (args.length === 1 || callee.kind !== 'Identifier' || callee.name !== 'Array' || node.typeArguments !== undefined) return
      let text = '[]'
      if (args.length > 0) {
        // how: the literal keeps every character between the parentheses, comments and trailing comma included.
        const open = tokensBetween(context.tree, callee.end, node.end).find(
          (token) => context.file.text[token.start] === '('
        ) as SourceToken
        text = `[${context.file.text.slice(open.end, node.end - 1)}]`
      }
      context.report({
        start: node.start,
        end: node.end,
        message: 'The array literal notation [] is preferable.',
        fix: { start: node.start, end: node.end, text },
      })
    }
    return { CallExpression: check, NewExpression: check }
  },
})
