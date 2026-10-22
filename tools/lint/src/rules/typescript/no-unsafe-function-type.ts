/**
 * The global `Function` type accepts any callable and types its calls as `any`; a function type
 * with parameters and a return type says what is accepted. A declared `Function` of the
 * program's own passes.
 *
 * @module rules/typescript/no-unsafe-function-type
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { scopeAnalysisOf } from '../../scope/analysis.ts'
import { isReferenceToGlobal } from './shared/references.ts'

export default defineRule<undefined, Node>({
  id: 'typescript/no-unsafe-function-type',
  language: 'code',
  fixable: false,
  create(context) {
    const analysis = scopeAnalysisOf(context)
    const check = (node: Node): void => {
      if (node.kind !== 'Identifier' || node.name !== 'Function' || !isReferenceToGlobal(analysis, node, 'Function')) return
      context.report({
        start: node.start,
        end: node.end,
        message:
          'The `Function` type accepts any function-like value.\nPrefer explicitly defining any function parameters and return type.',
      })
    }
    return {
      TSClassImplements: (node) => check(node.expression as Node),
      TSInterfaceHeritage: (node) => check(node.expression as Node),
      TSTypeReference: (node) => check(node.typeName as Node),
    }
  },
})
