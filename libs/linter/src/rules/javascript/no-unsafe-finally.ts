/**
 * A `return`, `throw`, `break` or `continue` inside a finally block overrides whatever the try
 * and catch blocks completed with, swallowing their return values and exceptions.
 *
 * @module rules/javascript/no-unsafe-finally
 */

import type { Node } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'

/** The kinds no jump crosses: the program, functions and classes. */
const BOUNDARIES = createSet<string>([
  'Program',
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassDeclaration',
  'ClassExpression',
])

/** The kinds of loop. */
const LOOP_KINDS = ['DoWhileStatement', 'WhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement']

/** What a `continue` targets. */
const LOOPS = createSet<string>(LOOP_KINDS)

/** What an unlabelled `break` targets. */
const LOOPS_AND_SWITCHES = createSet<string>([...LOOP_KINDS, 'SwitchStatement'])

/** What a return, a throw or a labelled break targets within a function: nothing. */
const NOTHING = createSet<string>([])

export default defineRule<undefined, Node>({
  id: 'no-unsafe-finally',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (node: Node): void => {
      if (!leavesFinally(node)) return
      context.report({ start: node.start, end: node.end, message: `Unsafe usage of ${node.kind}.` })
    }
    return { ReturnStatement: check, ThrowStatement: check, BreakStatement: check, ContinueStatement: check }
  },
})

/**
 * Whether a jump leaves a finally block: walking up from it, a finally block comes before anything
 * the jump could target, a loop for a `continue`, a loop or switch for an unlabelled `break`, the
 * labelled statement for a labelled jump, the enclosing function otherwise.
 *
 * @param jump - The return, throw, break or continue statement
 * @returns Whether a finally block is what the jump leaves
 */
function leavesFinally(jump: Node): boolean {
  const label = jump.label as Node | null | undefined
  const name = label === null || label === undefined ? null : (label.name as string)
  const targets = jump.kind === 'ContinueStatement' ? LOOPS : jump.kind === 'BreakStatement' && name === null ? LOOPS_AND_SWITCHES : NOTHING
  let labelled = false
  for (let node = jump; !BOUNDARIES.has(node.kind) && !targets.has(node.kind); node = node.parent as Node) {
    const parent = node.parent as Node
    if (parent.kind === 'LabeledStatement' && (parent.label as Node).name === name) labelled = true
    if (parent.kind === 'TryStatement' && parent.finalizer === node) return !labelled
  }
  return false
}
