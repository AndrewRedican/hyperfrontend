/**
 * Whether a generator yields a value: a `yield` with an argument, `yield*` included, anywhere in
 * its body outside the functions nested in it.
 *
 * @module rules/jsdoc/shared/yields
 */

import type { Node } from '../../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { childrenOf } from '../../../code/children.ts'

/** The functions whose yields belong to themselves. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/**
 * Whether a node holds a `yield` with an argument outside nested functions.
 *
 * @param node - The node searched
 * @returns Whether a value is yielded
 */
function holdsYieldValue(node: Node): boolean {
  if (node.kind === 'YieldExpression' && node.argument !== null) return true
  return childrenOf(node).some((child) => !FUNCTIONS.has(child.kind) && holdsYieldValue(child))
}

/**
 * Whether a function yields a value.
 *
 * @param node - The function or declared signature
 * @returns Whether its body yields a value
 */
export function yieldsValue(node: Node): boolean {
  const body = node.body as Node | undefined
  return body !== undefined && holdsYieldValue(body)
}
