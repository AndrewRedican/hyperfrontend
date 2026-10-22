/**
 * A catch clause that only rethrows what it caught changes nothing: the try is noise, or the
 * clause alone is when a finally block justifies the try.
 *
 * @module rules/javascript/no-useless-catch
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'no-useless-catch',
  language: 'code',
  fixable: false,
  create: (context) => ({
    CatchClause(node) {
      const param = node.param as Node | null
      if (param === null || param.kind !== 'Identifier') return
      // why: only the first statement counts; nothing after a throw runs.
      const first = ((node.body as Node).body as readonly Node[])[0]
      if (first === undefined || first.kind !== 'ThrowStatement') return
      const thrown = first.argument as Node
      if (thrown.kind !== 'Identifier' || thrown.name !== param.name) return
      const statement = node.parent as Node
      if ((statement.finalizer as Node | null) === null) {
        context.report({ start: statement.start, end: statement.end, message: 'Unnecessary try/catch wrapper.' })
      } else {
        context.report({ start: node.start, end: node.end, message: 'Unnecessary catch clause.' })
      }
    },
  }),
})
