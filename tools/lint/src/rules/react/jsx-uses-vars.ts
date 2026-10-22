/**
 * A variable named as a JSX element, or as the root object of a member element name, is used:
 * this rule marks it so for the unused-variable rule. Lower-case and namespaced names are DOM
 * tags and mark nothing. It reports nothing itself.
 *
 * @module rules/react/jsx-uses-vars
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { findVariable, scopeAnalysisOf, scopeOf } from '../../scope/analysis.ts'

export default defineRule<undefined, Node>({
  id: 'react/jsx-uses-vars',
  language: 'code',
  fixable: false,
  create: (context) => ({
    JSXOpeningElement(node) {
      let name = node.name as Node
      if (name.kind === 'JSXNamespacedName') return
      if (name.kind === 'JSXIdentifier') {
        const first = (name.name as string)[0] as string
        if (first >= 'a' && first <= 'z') return
      }
      while (name.kind === 'JSXMemberExpression') name = name.object as Node
      const variable = findVariable(scopeOf(scopeAnalysisOf(context), node), name.name as string)
      if (variable !== null) variable.used = true
    },
  }),
})
