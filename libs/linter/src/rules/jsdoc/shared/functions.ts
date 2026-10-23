/**
 * The functions the jsdoc rules check by default, each with the block documenting it: function
 * declarations and expressions, arrow functions and declared signatures; a function no block
 * documents is passed over.
 *
 * @module rules/jsdoc/shared/functions
 */

import type { Node } from '../../../code/model'
import type { RuleContext } from '../../../engine/rule'
import type { Listeners } from '../../../engine/traverse'
import type { JsdocBlock } from '../../../jsdoc/parse'
import { jsdocOf } from '../../../jsdoc/attach'

/** The kinds of node checked when a rule names no contexts. */
export const FUNCTION_KINDS: readonly string[] = [
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSDeclareFunction',
]

/** What a rule does with one documented node. */
export type DocumentedVisitor = (node: Node, block: JsdocBlock) => void

/**
 * Listeners that call a visitor on every node of the given kinds that a block documents.
 *
 * @param context - The rule's context
 * @param visit - What the rule does with a node and its block
 * @param kinds - The kinds visited; the function kinds unless given
 * @returns The listeners
 *
 * @example Build a rule's listeners over documented functions
 * ```ts
 * create: (context) =>
 *   documentedNodes(context, (node, block) => {
 *     if (!block.tags.some(({ tag }) => tag === 'returns')) {
 *       reportBlock(context, block, 'Missing JSDoc @returns declaration.')
 *     }
 *   })
 * ```
 *
 * @example Visit documented classes instead
 * ```ts
 * documentedNodes(context, visit, ['ClassDeclaration'])
 * // => { ClassDeclaration: listener }
 * ```
 */
export function documentedNodes(
  context: RuleContext<unknown, Node>,
  visit: DocumentedVisitor,
  kinds: readonly string[] = FUNCTION_KINDS
): Listeners<Node> {
  const listener = (node: Node): void => {
    const block = jsdocOf(context, node)
    if (block !== null) visit(node, block)
  }
  const listeners: Record<string, (node: Node) => void> = {}
  for (const kind of kinds) listeners[kind] = listener
  return listeners
}
