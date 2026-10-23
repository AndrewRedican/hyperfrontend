/**
 * A variable that holds `this` is a pre-arrow-function habit; an arrow function keeps `this`
 * without a copy. Destructuring members out of `this` passes.
 *
 * @module rules/typescript/no-this-alias
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'typescript/no-this-alias',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (target: Node, value: Node | null): void => {
      if (value === null || value.kind !== 'ThisExpression' || target.kind !== 'Identifier') return
      context.report({ start: target.start, end: target.end, message: "Unexpected aliasing of 'this' to local variable." })
    }
    return {
      VariableDeclarator(node) {
        check(node.id as Node, node.init as Node | null)
      },
      AssignmentExpression(node) {
        check(node.left as Node, node.right as Node)
      },
    }
  },
})
