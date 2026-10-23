/**
 * A read-only global, one the language or the configuration declares, is never assigned.
 *
 * @module rules/javascript/no-global-assign
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf } from '../../scope/analysis'

/** The rule's options. */
export interface NoGlobalAssignOptions {
  /** Globals that may be assigned all the same. */
  readonly exceptions?: readonly string[]
}

export default defineRule<NoGlobalAssignOptions | undefined, Node>({
  id: 'no-global-assign',
  language: 'code',
  fixable: false,
  create(context) {
    const exceptions = context.options?.exceptions ?? []
    return {
      Program() {
        for (const variable of scopeAnalysisOf(context).global.variables) {
          if (variable.writable !== false || exceptions.includes(variable.name)) continue
          variable.references.forEach((ref, index, references) => {
            // why: a read-write reference is one identifier; it is reported once.
            if (!ref.isWrite() || ref.init || references[index - 1]?.identifier === ref.identifier) return
            context.report({
              start: ref.identifier.start,
              end: ref.identifier.end,
              message: `Read-only global '${variable.name}' should not be modified.`,
            })
          })
        }
      },
    }
  },
})
