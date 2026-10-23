/**
 * A `debugger` statement halts execution under a debugger and has no place in committed code.
 *
 * @module rules/javascript/no-debugger
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'no-debugger',
  language: 'code',
  fixable: false,
  create: (context) => ({
    DebuggerStatement(node) {
      context.report({ start: node.start, end: node.end, message: "Unexpected 'debugger' statement." })
    },
  }),
})
