/**
 * The block documenting a function, looked up through its overloads: a top-level function
 * without a block of its own takes the block of the overload signature right before it, as the
 * previous linter read `function f(a: string): void` followed by its implementation.
 *
 * @module rules/jsdoc/shared/overloads
 */

import type { Node } from '../../../code/model.ts'
import type { RuleContext } from '../../../engine/rule.ts'
import type { JsdocBlock } from '../../../jsdoc/parse.ts'
import { jsdocOf, reducedNode } from '../../../jsdoc/attach.ts'

/**
 * The function a top-level statement declares: itself, or the declaration it exports.
 *
 * @param statement - The statement, or undefined
 * @returns The function declaration or signature, or null
 */
function declaredFunction(statement: Node | undefined): Node | null {
  if (statement === undefined) return null
  const declared = statement.kind === 'ExportNamedDeclaration' ? (statement.declaration as Node | null) : statement
  return declared !== null && (declared.kind === 'FunctionDeclaration' || declared.kind === 'TSDeclareFunction') ? declared : null
}

/**
 * The name of a function declaration or signature.
 *
 * @param node - The function
 * @returns Its name, or undefined when it has none
 */
function nameOf(node: Node): string | undefined {
  return (node.id as Node | null)?.name as string | undefined
}

/**
 * The block documenting a node, or for a top-level function without one, the block of the
 * overload signature of the same name right before it.
 *
 * @param context - The rule's context
 * @param node - The node documented
 * @returns The block, or null
 */
export function jsdocWithOverloads(context: RuleContext<unknown, Node>, node: Node): JsdocBlock | null {
  const own = jsdocOf(context, node)
  if (own !== null) return own
  const reduced = reducedNode(context.file, context.tree, node)
  const statement = (reduced.parent as Node).kind === 'ExportNamedDeclaration' ? (reduced.parent as Node) : reduced
  const program = statement.parent as Node
  const declared = declaredFunction(statement)
  if (program.kind !== 'Program' || declared === null) return null
  const body = program.body as readonly Node[]
  const previous = declaredFunction(body[body.indexOf(statement) - 1])
  if (previous === null || previous.kind !== 'TSDeclareFunction' || nameOf(previous) !== nameOf(declared)) return null
  return jsdocWithOverloads(context, previous)
}
