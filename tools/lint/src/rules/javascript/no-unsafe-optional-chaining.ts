/**
 * An optional chain that short-circuits is `undefined`; used where a value is required, as a
 * callee, an object, a superclass, a spread source, a destructured value or the right side of
 * `in` and `instanceof`, it throws.
 *
 * @module rules/javascript/no-unsafe-optional-chaining
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

/** What is reported. */
const MESSAGE = "Unsafe usage of optional chaining. If it short-circuits with 'undefined' the evaluation will throw TypeError."

export default defineRule<undefined, Node>({
  id: 'no-unsafe-optional-chaining',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (node: Node | null): void => {
      for (const chain of shortCircuits(node)) context.report({ start: chain.start, end: chain.end, message: MESSAGE })
    }
    const checkDestructuring = (node: Node): void => {
      if (isPattern(node.left as Node)) check(node.right as Node)
    }
    const checkSuperClass = (node: Node): void => {
      check(node.superClass as Node | null)
    }
    return {
      AssignmentExpression: checkDestructuring,
      AssignmentPattern: checkDestructuring,
      ClassDeclaration: checkSuperClass,
      ClassExpression: checkSuperClass,
      VariableDeclarator(node) {
        if (isPattern(node.id as Node)) check(node.init as Node | null)
      },
      CallExpression(node) {
        if (node.optional !== true) check(node.callee as Node)
      },
      NewExpression(node) {
        check(node.callee as Node)
      },
      MemberExpression(node) {
        if (node.optional !== true) check(node.object as Node)
      },
      TaggedTemplateExpression(node) {
        check(node.tag as Node)
      },
      ForOfStatement(node) {
        check(node.right as Node)
      },
      SpreadElement(node) {
        if ((node.parent as Node).kind !== 'ObjectExpression') check(node.argument as Node)
      },
      BinaryExpression(node) {
        if (node.operator === 'in' || node.operator === 'instanceof') check(node.right as Node)
      },
    }
  },
})

/**
 * Whether a node destructures.
 *
 * @param node - An assignment target or a declared name
 * @returns Whether it is an object or array pattern
 */
function isPattern(node: Node): boolean {
  return node.kind === 'ObjectPattern' || node.kind === 'ArrayPattern'
}

/**
 * The optional chains an expression may evaluate to: the right side of `||` and `??`, both sides
 * of `&&`, the last expression of a sequence, both branches of a conditional, and what an await
 * awaits.
 *
 * @param node - The expression, or null when there is none
 * @returns The chains, in source order
 */
function shortCircuits(node: Node | null): Node[] {
  if (node === null) return []
  if (node.kind === 'ChainExpression') return [node]
  if (node.kind === 'LogicalExpression') {
    const right = shortCircuits(node.right as Node)
    return node.operator === '&&' ? [...shortCircuits(node.left as Node), ...right] : right
  }
  if (node.kind === 'SequenceExpression') {
    const expressions = node.expressions as readonly Node[]
    return shortCircuits(expressions[expressions.length - 1] as Node)
  }
  if (node.kind === 'ConditionalExpression') return [...shortCircuits(node.consequent as Node), ...shortCircuits(node.alternate as Node)]
  if (node.kind === 'AwaitExpression') return shortCircuits(node.argument as Node)
  return []
}
