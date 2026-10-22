/**
 * JSX compiles to calls on the pragma, so every element uses it, and every fragment uses the
 * fragment component too: this rule marks those variables used for the unused-variable rule.
 * It reports nothing itself.
 *
 * @module rules/react/jsx-uses-react
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { findVariable, scopeAnalysisOf, scopeOf } from '../../scope/analysis.ts'
import { fragmentOf, pragmaOf } from './shared/settings.ts'

export default defineRule<undefined, Node>({
  id: 'react/jsx-uses-react',
  language: 'code',
  fixable: false,
  create(context) {
    const pragma = pragmaOf(context.file, context.settings)
    const fragment = fragmentOf(context.settings)
    const mark = (node: Node, name: string): void => {
      const variable = findVariable(scopeOf(scopeAnalysisOf(context), node), name)
      if (variable !== null) variable.used = true
    }
    return {
      JSXOpeningElement(node) {
        mark(node, pragma)
      },
      JSXOpeningFragment(node) {
        mark(node, pragma)
        mark(node, fragment)
      },
    }
  },
})
