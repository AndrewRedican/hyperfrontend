/**
 * Elements in an array literal, or returned by the callback of `map` or `Array.from`, need a
 * `key` prop for React to track them; each element without one is reported. Nothing inside a
 * `Children.toArray(...)` call is checked, since it assigns keys itself.
 *
 * @module rules/react/jsx-key
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { pragmaOf } from './shared/settings.ts'

/** The message for an element of an array literal. */
const ARRAY_MESSAGE = 'Missing "key" prop for element in array'

/** The message for an element an iterator callback returns. */
const ITERATOR_MESSAGE = 'Missing "key" prop for element in iterator'

/**
 * Whether an element names a `key` attribute; a spread does not count.
 *
 * @param element - The JSX element checked
 * @returns Whether it has a `key` attribute
 */
function hasKey(element: Node): boolean {
  const attributes = (element.openingElement as Node).attributes as readonly Node[]
  return attributes.some((attribute) => attribute.kind === 'JSXAttribute' && (attribute.name as Node).name === 'key')
}

/**
 * Whether a node is a function expression or an arrow.
 *
 * @param node - The node checked, or undefined
 * @returns Whether it is a callback a check can look into
 */
function isFunctionLike(node: Node | undefined): node is Node {
  return node !== undefined && (node.kind === 'FunctionExpression' || node.kind === 'ArrowFunctionExpression')
}

/**
 * The expressions a callback yields that could be an element: an expression body, both sides of a
 * conditional body, the right side of a logical body, and the arguments of the returns in a block
 * body, followed through `if` branches and the blocks of the body and of those branches.
 *
 * @param callback - The function expression or arrow
 * @returns The candidate expressions
 */
function yieldedBy(callback: Node): Node[] {
  const body = callback.body as Node
  if (body.kind === 'BlockStatement') {
    const returns: Node[] = []
    collectReturns(body, returns)
    return returns.map((statement) => statement.argument as Node | null).filter((argument): argument is Node => argument !== null)
  }
  if (body.kind === 'ConditionalExpression') return [body.consequent as Node, body.alternate as Node]
  if (body.kind === 'LogicalExpression') return [body.right as Node]
  return [body]
}

/**
 * Collects the return statements of a block or `if`, looking into `if` branches and blocks but
 * no other statement.
 *
 * @param node - The statement looked into
 * @param returns - The return statements found so far, extended in place
 */
function collectReturns(node: Node, returns: Node[]): void {
  if (node.kind === 'IfStatement') {
    collectReturns(node.consequent as Node, returns)
    const alternate = node.alternate as Node | null
    if (alternate !== null) collectReturns(alternate, returns)
  } else if (node.kind === 'ReturnStatement') {
    returns.push(node)
  } else if (node.kind === 'BlockStatement') {
    for (const statement of node.body as readonly Node[]) {
      if (statement.kind === 'IfStatement' || statement.kind === 'ReturnStatement') collectReturns(statement, returns)
    }
  }
}

export default defineRule<undefined, Node>({
  id: 'react/jsx-key',
  language: 'code',
  fixable: false,
  create(context) {
    const pragma = pragmaOf(context.file, context.settings)
    let inToArray = false
    const isToArray = (node: Node): boolean => {
      const callee = node.callee as Node
      if (callee.kind !== 'MemberExpression' || (callee.property as Node).name !== 'toArray') return false
      const object = callee.object as Node
      if (object.kind === 'Identifier') return object.name === 'Children'
      return object.kind === 'MemberExpression' && (object.property as Node).name === 'Children' && (object.object as Node).name === pragma
    }
    const checkCallback = (callback: Node | undefined): void => {
      if (!isFunctionLike(callback)) return
      for (const candidate of yieldedBy(callback)) {
        if (candidate.kind !== 'JSXElement' || hasKey(candidate)) continue
        context.report({ start: candidate.start, end: candidate.end, message: ITERATOR_MESSAGE })
      }
    }
    return {
      CallExpression(node) {
        if (isToArray(node)) inToArray = true
        if (inToArray) return
        const callee = node.callee as Node
        if (callee.kind !== 'MemberExpression') return
        const name = (callee.property as Node).name
        const callbacks = node.arguments as readonly Node[]
        if (name === 'map') checkCallback(callbacks[0])
        else if (name === 'from') checkCallback(callbacks[1])
      },
      'CallExpression:exit'(node) {
        if (isToArray(node)) inToArray = false
      },
      ArrayExpression(node) {
        if (inToArray) return
        for (const element of node.elements as readonly (Node | null)[]) {
          if (element === null || element.kind !== 'JSXElement' || hasKey(element)) continue
          context.report({ start: element.start, end: element.end, message: ARRAY_MESSAGE })
        }
      },
    }
  },
})
