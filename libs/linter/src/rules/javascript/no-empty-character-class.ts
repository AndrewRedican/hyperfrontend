/**
 * An empty character class, `[]`, matches nothing, so the expression around it never matches;
 * it is a mistake, unlike `[^]`, which matches anything.
 *
 * @module rules/javascript/no-empty-character-class
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { visit } from '../../regex/model'
import { parse } from '../../regex/parse'

export default defineRule<undefined, Node>({
  id: 'no-empty-character-class',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Literal(node) {
      if (node.regex === undefined) return
      const { pattern } = parse(node.regex.pattern, node.regex.flags)
      if (pattern === null) return
      visit(pattern, (item) => {
        if (item.kind === 'CharacterClass' && !item.negate && item.elements.length === 0) {
          context.report({ start: node.start, end: node.end, message: 'Empty class.' })
        }
      })
    },
  }),
})
