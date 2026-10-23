/**
 * The parameter of a `catch` clause holds the exception; assigning it loses that exception.
 *
 * @module rules/javascript/no-ex-assign
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf } from '../../scope/analysis'

export default defineRule<undefined, Node>({
  id: 'no-ex-assign',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      CatchClause(node) {
        for (const variable of scopeAnalysisOf(context).declaredVariables(node)) {
          variable.references.forEach((ref, index, references) => {
            // why: a destructuring default writes the same identifier twice; it is reported once.
            if (!ref.isWrite() || ref.init || references[index - 1]?.identifier === ref.identifier) return
            context.report({ start: ref.identifier.start, end: ref.identifier.end, message: 'Do not assign to the exception parameter.' })
          })
        }
      },
    }
  },
})
