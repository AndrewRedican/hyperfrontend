/**
 * The implicit `arguments` object of a function is an array-like with no array methods; a
 * rest parameter gives the same values as a real array. Reading a property of `arguments`
 * such as `length` or `callee` passes, as a rest parameter has no equivalent for every one.
 *
 * @module rules/javascript/prefer-rest-params
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf, scopeOf } from '../../scope/analysis'

export default defineRule<undefined, Node>({
  id: 'prefer-rest-params',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (node: Node): void => {
      const analysis = scopeAnalysisOf(context)
      const variable = scopeOf(analysis, node).set.get('arguments')
      // why: a parameter or declaration named `arguments` replaces the implicit object; the name then has identifiers.
      if (variable === undefined || variable.identifiers.length > 0) return
      for (const ref of variable.references) {
        const { identifier } = ref
        const parent = identifier.parent as Node
        if (parent.kind === 'MemberExpression' && parent.object === identifier && parent.computed !== true) continue
        context.report({ start: identifier.start, end: identifier.end, message: "Use the rest parameters instead of 'arguments'." })
      }
    }
    return {
      'FunctionDeclaration:exit': check,
      'FunctionExpression:exit': check,
    }
  },
})
