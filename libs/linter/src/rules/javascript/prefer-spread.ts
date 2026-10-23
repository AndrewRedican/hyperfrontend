/**
 * `f.apply(undefined, args)` and `obj.f.apply(obj, args)` say what `f(...args)` and
 * `obj.f(...args)` say, with more to read and get wrong.
 *
 * @module rules/javascript/prefer-spread
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { isMemberAccess, skipChain } from './shared/members'
import { sameTokens } from './shared/tokens'

export default defineRule<undefined, Node>({
  id: 'prefer-spread',
  language: 'code',
  fixable: false,
  create: (context) => ({
    CallExpression(node) {
      const callee = node.callee as Node
      const callArguments = node.arguments as readonly Node[]
      if (callArguments.length !== 2 || !isMemberAccess(callee, null, 'apply')) return
      const [thisArgument, spreadArgument] = callArguments as [Node, Node]
      if (spreadArgument.kind === 'ArrayExpression' || spreadArgument.kind === 'SpreadElement') return
      const applied = skipChain(skipChain(callee).object as Node)
      const expectedThis = applied.kind === 'MemberExpression' ? (applied.object as Node) : null
      const matches =
        expectedThis === null ? isNullOrUndefined(thisArgument) : sameTokens(context.tree, context.file, expectedThis, thisArgument)
      if (!matches) return
      context.report({ start: node.start, end: node.end, message: "Use the spread operator instead of '.apply()'." })
    },
  }),
})

/**
 * Whether an expression is `null`, `undefined` or a `void` expression.
 *
 * @param node - The expression tested
 * @returns Whether it is one of those
 */
function isNullOrUndefined(node: Node): boolean {
  if (node.kind === 'Literal') return node.raw === 'null'
  if (node.kind === 'Identifier') return node.name === 'undefined'
  return node.kind === 'UnaryExpression' && node.operator === 'void'
}
