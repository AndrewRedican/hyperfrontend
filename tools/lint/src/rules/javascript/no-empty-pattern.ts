/**
 * An empty destructuring pattern binds nothing; it is usually a typo for a default value.
 *
 * @module rules/javascript/no-empty-pattern
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'no-empty-pattern',
  language: 'code',
  fixable: false,
  create: (context) => ({
    ObjectPattern(node) {
      if ((node.properties as readonly Node[]).length > 0) return
      context.report({ start: node.start, end: node.end, message: 'Unexpected empty object pattern.' })
    },
    ArrayPattern(node) {
      if ((node.elements as readonly (Node | null)[]).length > 0) return
      context.report({ start: node.start, end: node.end, message: 'Unexpected empty array pattern.' })
    },
  }),
})
