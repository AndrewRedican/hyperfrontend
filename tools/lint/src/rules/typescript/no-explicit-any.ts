/**
 * The `any` type switches the checker off for whatever it touches; every written `any` is
 * reported so that a narrower type, or `unknown`, is chosen instead.
 *
 * @module rules/typescript/no-explicit-any
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'typescript/no-explicit-any',
  language: 'code',
  fixable: false,
  create: (context) => ({
    TSAnyKeyword(node) {
      context.report({ start: node.start, end: node.end, message: 'Unexpected any. Specify a different type.' })
    },
  }),
})
