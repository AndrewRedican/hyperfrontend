/**
 * A hole in an array literal, two commas with nothing between them, is almost always a typo.
 *
 * @module rules/javascript/no-sparse-arrays
 */

import type { Node } from '../../code/model.ts'
import { tokensBetween } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'no-sparse-arrays',
  language: 'code',
  fixable: false,
  create: (context) => ({
    ArrayExpression(node) {
      const elements = node.elements as readonly (Node | null)[]
      if (!elements.includes(null)) return
      // how: each comma at the array's own level ends one element; the comma ending a hole is what is reported.
      let index = 0
      for (const token of tokensBetween(context.tree, node.start + 1, node.end - 1)) {
        const element = elements[index] as Node | null
        if (element !== null && token.start < element.end) continue
        if (context.file.text[token.start] !== ',') continue
        if (element === null) context.report({ start: token.start, end: token.end, message: 'Unexpected comma in middle of array.' })
        index += 1
      }
    },
  }),
})
