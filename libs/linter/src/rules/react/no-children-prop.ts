/**
 * Children belong between an element's tags, or after the props of `createElement`; passing
 * them as a `children` prop is reported on the attribute or on the call.
 *
 * @module rules/react/no-children-prop
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { isFromPragma } from './shared/pragma-import'
import { pragmaOf } from './shared/settings'

export default defineRule<undefined, Node>({
  id: 'react/no-children-prop',
  language: 'code',
  fixable: false,
  create(context) {
    const pragma = pragmaOf(context.file, context.settings)
    const isCreateElement = (call: Node): boolean => {
      const callee = call.callee as Node
      if (callee.kind === 'MemberExpression') {
        return (callee.property as Node).name === 'createElement' && (callee.object as Node).name === pragma
      }
      return callee.name === 'createElement' && isFromPragma(context, call, 'createElement', pragma)
    }
    return {
      JSXAttribute(node) {
        if ((node.name as Node).name !== 'children') return
        context.report({
          start: node.start,
          end: node.end,
          message: 'Do not pass children as props. Instead, nest children between the opening and closing tags.',
        })
      },
      CallExpression(node) {
        const props = (node.arguments as readonly Node[])[1]
        if (props === undefined || props.kind !== 'ObjectExpression' || !isCreateElement(node)) return
        const named = (props.properties as readonly Node[]).some((property) => (property.key as Node | undefined)?.name === 'children')
        if (!named) return
        context.report({
          start: node.start,
          end: node.end,
          message: 'Do not pass children as props. Instead, pass them as additional arguments to React.createElement.',
        })
      },
    }
  },
})
