/**
 * Two `case` labels written the same way select the same value, so the second can never match.
 *
 * @module rules/javascript/no-duplicate-case
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { sameTokens } from './shared/tokens.ts'

export default defineRule<undefined, Node>({
  id: 'no-duplicate-case',
  language: 'code',
  fixable: false,
  create: (context) => ({
    SwitchStatement(node) {
      const seen: Node[] = []
      for (const switchCase of node.cases as readonly Node[]) {
        const test = switchCase.test as Node | null
        if (test === null) continue
        if (seen.some((earlier) => sameTokens(context.tree, context.file, earlier, test))) {
          context.report({ start: switchCase.start, end: switchCase.end, message: 'Duplicate case label.' })
        } else {
          seen.push(test)
        }
      }
    },
  }),
})
