/**
 * An async executor passed to `new Promise` swallows the errors it throws and usually means an
 * `await` that the promise did not need.
 *
 * @module rules/javascript/no-async-promise-executor
 */

import type { Node, SourceToken } from '../../code/model.ts'
import { tokenAfter } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'no-async-promise-executor',
  language: 'code',
  fixable: false,
  create: (context) => ({
    NewExpression(node) {
      const callee = node.callee as Node
      if (callee.kind !== 'Identifier' || callee.name !== 'Promise') return
      const executor = (node.arguments as readonly Node[])[0]
      // why: only a function or arrow carries `async`, so the flag alone says the executor is one.
      if (executor === undefined || executor.async !== true) return
      // how: the report sits on the `async` keyword, the executor's first token.
      const keyword = tokenAfter(context.tree, executor.start) as SourceToken
      context.report({ start: keyword.start, end: keyword.end, message: 'Promise executor functions should not be async.' })
    },
  }),
})
