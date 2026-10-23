/**
 * A non-null assertion on a value that is asserted again, or that an optional chain then
 * treats as possibly nullish, does nothing; its `!` is removed.
 *
 * @module rules/typescript/no-extra-non-null-assertion
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'typescript/no-extra-non-null-assertion',
  language: 'code',
  fixable: true,
  create: (context) => ({
    TSNonNullExpression(node) {
      const parent = node.parent as Node
      const extra =
        parent.kind === 'TSNonNullExpression' ||
        (parent.kind === 'MemberExpression' && parent.optional === true && parent.object === node) ||
        (parent.kind === 'CallExpression' && parent.optional === true && parent.callee === node)
      if (!extra) return
      context.report({
        start: node.start,
        end: node.end,
        message: 'Forbidden extra non-null assertion.',
        fix: { start: node.end - 1, end: node.end, text: '' },
      })
    },
  }),
})
