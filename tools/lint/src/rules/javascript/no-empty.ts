/**
 * An empty block or switch statement is usually a mistake or a leftover; a comment inside a
 * block states that it is empty on purpose.
 *
 * @module rules/javascript/no-empty
 */

import type { Node, SourceToken } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { commentsBetween, tokensBetween } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'

/** The rule's options. */
export interface NoEmptyOptions {
  /** Whether an empty catch block passes. */
  readonly allowEmptyCatch?: boolean
}

/** The kinds of node whose body block is a function body, which may be empty. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

export default defineRule<NoEmptyOptions | undefined, Node>({
  id: 'no-empty',
  language: 'code',
  fixable: false,
  create(context) {
    const allowEmptyCatch = context.options?.allowEmptyCatch === true
    return {
      BlockStatement(node) {
        const parent = node.parent as Node
        if ((node.body as readonly Node[]).length > 0 || FUNCTIONS.has(parent.kind)) return
        if (allowEmptyCatch && parent.kind === 'CatchClause') return
        if (commentsBetween(context.file, node.start, node.end).length > 0) return
        context.report({ start: node.start, end: node.end, message: 'Empty block statement.' })
      },
      SwitchStatement(node) {
        if ((node.cases as readonly Node[]).length > 0) return
        // why: the braces are what is empty; a comment between them keeps the switch, one before them does not.
        const open = tokensBetween(context.tree, (node.discriminant as Node).end, node.end).find(
          (token) => context.file.text[token.start] === '{'
        ) as SourceToken
        if (commentsBetween(context.file, open.end, node.end).length > 0) return
        context.report({ start: open.start, end: node.end, message: 'Empty switch statement.' })
      },
    }
  },
})
