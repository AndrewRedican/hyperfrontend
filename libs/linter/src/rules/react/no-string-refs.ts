/**
 * String refs are a legacy API: a string literal as a `ref` attribute is reported, and before
 * React 18.3 so is reading `this.refs` inside a class component.
 *
 * @module rules/react/no-string-refs
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { parentEs5Component, parentEs6Component } from './shared/class-components'
import { atLeast, reactVersion } from './shared/settings'

export default defineRule<undefined, Node>({
  id: 'react/no-string-refs',
  language: 'code',
  fixable: false,
  create(context) {
    const checkRefs = !atLeast(reactVersion(context.settings), [18, 3, 0])
    return {
      MemberExpression(node) {
        if (!checkRefs || (node.object as Node).kind !== 'ThisExpression' || (node.property as Node).name !== 'refs') return
        if (parentEs6Component(context, node) === null && parentEs5Component(context, node) === null) return
        context.report({ start: node.start, end: node.end, message: 'Using this.refs is deprecated.' })
      },
      JSXAttribute(node) {
        if ((node.name as Node).name !== 'ref' || !isStringValue(node.value as Node | null)) return
        context.report({ start: node.start, end: node.end, message: 'Using string literals in ref attributes is deprecated.' })
      },
    }
  },
})

/**
 * Whether an attribute's value is a string literal, quoted or in braces.
 *
 * @param value - The attribute's value, or null when it has none
 * @returns Whether the value is a string
 */
function isStringValue(value: Node | null): boolean {
  if (value === null) return false
  const literal = value.kind === 'JSXExpressionContainer' ? (value.expression as Node) : value
  return literal.kind === 'Literal' && typeof literal.value === 'string'
}
