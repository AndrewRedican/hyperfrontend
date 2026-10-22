/**
 * A non-null assertion tells the checker what it cannot see and leaves the runtime to find out;
 * every `!` written after an expression is reported.
 *
 * @module rules/typescript/no-non-null-assertion
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'typescript/no-non-null-assertion',
  language: 'code',
  fixable: false,
  create: (context) => ({
    TSNonNullExpression(node) {
      context.report({ start: node.start, end: node.end, message: 'Forbidden non-null assertion.' })
    },
  }),
})
