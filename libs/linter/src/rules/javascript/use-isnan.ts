/**
 * `NaN` equals nothing, itself included: comparing a value with it, switching on it or matching
 * a case against it never does what was meant; `Number.isNaN` does.
 *
 * @module rules/javascript/use-isnan
 */

import type { Node } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { isMemberAccess } from './shared/members'

/** The rule's options. */
export interface UseIsnanOptions {
  /** Whether `switch (NaN)` and `case NaN:` are reported; they are unless this is false. */
  readonly enforceForSwitchCase?: boolean
}

/** The operators that compare two values. */
const COMPARISONS = createSet<string>(['==', '===', '!=', '!==', '<', '>', '<=', '>='])

export default defineRule<UseIsnanOptions | undefined, Node>({
  id: 'use-isnan',
  language: 'code',
  fixable: false,
  create(context) {
    const enforceForSwitchCase = context.options?.enforceForSwitchCase !== false
    return {
      BinaryExpression(node) {
        if (!COMPARISONS.has(node.operator as string)) return
        if (!isNaNValue(node.left as Node) && !isNaNValue(node.right as Node)) return
        context.report({ start: node.start, end: node.end, message: 'Use the isNaN function to compare with NaN.' })
      },
      SwitchStatement(node) {
        if (!enforceForSwitchCase) return
        if (isNaNValue(node.discriminant as Node)) {
          context.report({
            start: node.start,
            end: node.end,
            message: "'switch(NaN)' can never match a case clause. Use Number.isNaN instead of the switch.",
          })
        }
        for (const switchCase of node.cases as readonly Node[]) {
          const test = switchCase.test as Node | null
          if (test === null || !isNaNValue(test)) continue
          context.report({
            start: switchCase.start,
            end: switchCase.end,
            message: "'case NaN' can never match. Use Number.isNaN before the switch.",
          })
        }
      },
    }
  },
})

/**
 * Whether an expression is `NaN` or `Number.NaN`, or a sequence that ends in one.
 *
 * @param node - The expression tested
 * @returns Whether its value is `NaN` as written
 */
function isNaNValue(node: Node): boolean {
  let checked = node
  if (node.kind === 'SequenceExpression') {
    const expressions = node.expressions as readonly Node[]
    checked = expressions[expressions.length - 1] as Node
  }
  if (checked.kind === 'Identifier') return checked.name === 'NaN'
  return isMemberAccess(checked, 'Number', 'NaN')
}
