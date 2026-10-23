/**
 * A generator function with statements but no `yield` is a plain function in disguise.
 *
 * @module rules/javascript/require-yield
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'require-yield',
  language: 'code',
  fixable: false,
  create(context) {
    // how: one count of yields per generator being read, innermost last; a yield in a nested arrow or plain function counts for the innermost generator.
    const counts: number[] = []
    const enter = (node: Node): void => {
      if (node.generator === true) counts.push(0)
    }
    const leave = (node: Node): void => {
      if (node.generator !== true) return
      const count = counts.pop() as number
      if (count > 0 || ((node.body as Node).body as readonly Node[]).length === 0) return
      context.report({ start: node.start, end: node.end, message: "This generator function does not have 'yield'." })
    }
    return {
      FunctionDeclaration: enter,
      'FunctionDeclaration:exit': leave,
      FunctionExpression: enter,
      'FunctionExpression:exit': leave,
      YieldExpression() {
        if (counts.length > 0) counts.push((counts.pop() as number) + 1)
      },
    }
  },
})
