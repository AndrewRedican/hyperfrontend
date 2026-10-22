/**
 * `findDOMNode` breaks abstraction, fails on function components and is deprecated in strict
 * mode; a call to it, bare or as a member, is reported at its callee.
 *
 * @module rules/react/no-find-dom-node
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

/** The message reported. */
const MESSAGE =
  'Do not use findDOMNode. It doesn’t work with function components and is deprecated in StrictMode. See https://reactjs.org/docs/react-dom.html#finddomnode'

export default defineRule<undefined, Node>({
  id: 'react/no-find-dom-node',
  language: 'code',
  fixable: false,
  create: (context) => ({
    CallExpression(node) {
      const callee = node.callee as Node
      if (!namesFindDomNode(callee)) return
      context.report({ start: callee.start, end: callee.end, message: MESSAGE })
    },
  }),
})

/**
 * Whether a callee is `findDOMNode` or a member named so with a plain property.
 *
 * @param callee - The callee of a call
 * @returns Whether it calls `findDOMNode`
 */
function namesFindDomNode(callee: Node): boolean {
  if (callee.kind === 'Identifier') return callee.name === 'findDOMNode'
  if (callee.kind !== 'MemberExpression' || callee.computed === true) return false
  const property = callee.property as Node
  return property.kind === 'Identifier' && property.name === 'findDOMNode'
}
