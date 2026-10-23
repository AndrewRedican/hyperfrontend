/**
 * No anonymous object type with named members appears inline: a shape is declared as a named type
 * alias or interface, where it can be documented and reused. An empty shape, an index signature
 * and a call signature alone may stay inline.
 *
 * @module rules/conventions/no-inline-type-literal
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

/** What the rule reports for an inline object type. */
const MESSAGE =
  'Anonymous inline type literal is not allowed. Extract it into a named `type` alias or `interface` so it can be documented and reused. JSDoc cannot be attached to inline shapes.'

export default defineRule<undefined, Node>({
  id: 'no-inline-type-literal',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      TSTypeLiteral(node) {
        const parent = node.parent as Node
        if (parent.kind === 'TSTypeAliasDeclaration' && parent.typeAnnotation === node) return
        const named = (node.members as readonly Node[]).some(
          (member) => member.kind === 'TSPropertySignature' || member.kind === 'TSMethodSignature'
        )
        if (named) context.report({ start: node.start, end: node.end, message: MESSAGE })
      },
    }
  },
})
