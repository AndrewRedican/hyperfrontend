/**
 * A spec does not wait a fixed stretch of real time and then assert that a mock was called: the
 * wait guesses how long the code under test takes, and a loaded CI runner takes longer. Promise
 * chains settle under `flushPromises`, a condition under `waitFor` or `waitUntil`, and timers under
 * the fake clock, each independent of machine speed. An awaited `sleep(…)`, or an awaited
 * `new Promise` whose executor calls `setTimeout`, is reported when a later statement of the same
 * block asserts a call with `toHaveBeenCalled`, `toHaveBeenCalledWith`, `toHaveBeenCalledTimes`,
 * `toHaveBeenLastCalledWith` or `toHaveBeenNthCalledWith`. Negated assertions and
 * `toHaveBeenCalledTimes(0)` are left alone: a fixed wait is a fair way to show something did not
 * happen.
 *
 * @module rules/workspace/no-sleep-before-call-assertion
 */

import type { Node } from '@hyperfrontend/linter'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { childrenOf } from '@hyperfrontend/linter/helpers'

/** The matchers that assert a mock was called. */
const CALL_MATCHERS = createSet([
  'toHaveBeenCalled',
  'toHaveBeenCalledWith',
  'toHaveBeenCalledTimes',
  'toHaveBeenLastCalledWith',
  'toHaveBeenNthCalledWith',
])

/** The kinds that open a function body, whose statements run on their own schedule. */
const FUNCTIONS = createSet(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/**
 * The name a callee reads: an identifier's own, or the property of a dotted member expression.
 *
 * @param callee - The callee of a call or new expression
 * @returns The name, or undefined for any other callee
 */
function calleeName(callee: Node): string | undefined {
  if (callee.kind === 'Identifier') return callee.name as string
  if (callee.kind === 'MemberExpression' && !callee.computed) return (callee.property as Node).name as string
  return undefined
}

/**
 * Whether a subtree calls `setTimeout`, looking into nested functions as well.
 *
 * @param node - The subtree's root
 * @returns True when some call in it names `setTimeout`
 */
function callsSetTimeout(node: Node): boolean {
  if (node.kind === 'CallExpression' && calleeName(node.callee as Node) === 'setTimeout') return true
  return childrenOf(node).some(callsSetTimeout)
}

/**
 * Whether a statement awaits a fixed real delay.
 *
 * @param statement - A statement of a block
 * @returns True for `await sleep(…)` and an awaited `new Promise` whose executor calls `setTimeout`
 */
function isDelay(statement: Node): boolean {
  if (statement.kind !== 'ExpressionStatement') return false
  const awaited = statement.expression as Node
  if (awaited.kind !== 'AwaitExpression') return false
  const argument = awaited.argument as Node
  if (argument.kind === 'CallExpression') return calleeName(argument.callee as Node) === 'sleep'
  if (argument.kind !== 'NewExpression' || calleeName(argument.callee as Node) !== 'Promise') return false
  const executor = (argument.arguments as readonly Node[])[0]
  return executor !== undefined && callsSetTimeout(executor)
}

/**
 * Whether a call asserts that a mock was called, as opposed to asserting that it was not.
 *
 * @param call - A call expression
 * @returns True for `expect(…).toHaveBeenCalled…(…)` without `.not`, other than `toHaveBeenCalledTimes(0)`
 */
function isCallAssertion(call: Node): boolean {
  const callee = call.callee as Node
  const matcher = calleeName(callee)
  if (callee.kind !== 'MemberExpression' || matcher === undefined || !CALL_MATCHERS.has(matcher)) return false
  const [count] = call.arguments as readonly Node[]
  if (matcher === 'toHaveBeenCalledTimes' && count?.kind === 'Literal' && count.value === 0) return false
  let subject = callee.object as Node
  while (subject.kind === 'MemberExpression') {
    const name = calleeName(subject)
    if (name === 'not' || name === undefined) return false
    subject = subject.object as Node
  }
  return subject.kind === 'CallExpression' && calleeName(subject.callee as Node) === 'expect'
}

/**
 * Whether a statement asserts a call outside any function nested in it.
 *
 * @param node - The statement, or a node within it
 * @returns True when a call assertion runs as part of the statement itself
 */
function assertsCall(node: Node): boolean {
  if (FUNCTIONS.has(node.kind)) return false
  if (node.kind === 'CallExpression' && isCallAssertion(node)) return true
  return childrenOf(node).some(assertsCall)
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-sleep-before-call-assertion',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      BlockStatement(node) {
        let pending: Node[] = []
        for (const statement of node.body as readonly Node[]) {
          if (isDelay(statement)) {
            pending.push(statement)
            continue
          }
          if (pending.length === 0 || !assertsCall(statement)) continue
          for (const delay of pending) {
            context.report({
              start: delay.start,
              end: delay.end,
              message:
                'Wait for the work itself rather than a fixed delay before asserting a call: flushPromises for promise chains, waitFor or waitUntil for a condition, the fake clock for timers.',
            })
          }
          pending = []
        }
      },
    }
  },
})
