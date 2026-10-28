/**
 * Two `case` labels written the same way select the same value, so the second can never match.
 *
 * @module rules/javascript/no-duplicate-case
 */

import type { Node } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { tokenKey } from './shared/tokens'

export default defineRule<undefined, Node>({
  id: 'no-duplicate-case',
  language: 'code',
  fixable: false,
  create: (context) => ({
    SwitchStatement(node) {
      // why: keyed by what is written, a switch of thousands of cases costs one lookup per case rather than a comparison against every earlier one.
      const seen = createSet<string>()
      for (const switchCase of node.cases as readonly Node[]) {
        const test = switchCase.test as Node | null
        if (test === null) continue
        const key = tokenKey(context.tree, context.file, test)
        if (seen.has(key)) {
          context.report({ start: switchCase.start, end: switchCase.end, message: 'Duplicate case label.' })
        } else {
          seen.add(key)
        }
      }
    },
  }),
})
