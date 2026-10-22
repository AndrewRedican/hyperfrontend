/**
 * `delete` on a plain variable does nothing in sloppy code and is a syntax error in strict code;
 * only a property can be deleted.
 *
 * @module rules/javascript/no-delete-var
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'no-delete-var',
  language: 'code',
  fixable: false,
  create: (context) => ({
    UnaryExpression(node) {
      if (node.operator !== 'delete' || (node.argument as Node).kind !== 'Identifier') return
      context.report({ start: node.start, end: node.end, message: 'Variables should not be deleted.' })
    },
  }),
})
