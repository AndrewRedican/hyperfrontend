/**
 * `this.isMounted()` is an anti-pattern deprecated with ES6 classes; a call to it inside an
 * object property or class method is reported at its callee.
 *
 * @module rules/react/no-is-mounted
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'react/no-is-mounted',
  language: 'code',
  fixable: false,
  create: (context) => ({
    CallExpression(node, parents) {
      const callee = node.callee as Node
      if (callee.kind !== 'MemberExpression' || callee.computed === true) return
      if ((callee.object as Node).kind !== 'ThisExpression') return
      const property = callee.property as Node
      if (property.kind !== 'Identifier' || property.name !== 'isMounted') return
      if (!parents.some((parent) => parent.kind === 'Property' || parent.kind === 'MethodDefinition')) return
      context.report({ start: callee.start, end: callee.end, message: 'Do not use isMounted' })
    },
  }),
})
