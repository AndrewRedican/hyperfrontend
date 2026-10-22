/**
 * A class component's `render` method that never returns renders nothing; a `render` member
 * whose value is a function without a return of its own (one not inside a nested function),
 * and that is no expression-bodied arrow, is reported.
 *
 * @module rules/react/require-render-return
 */

import type { Node } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { childrenOf } from '../../code/children.ts'
import { defineRule } from '../../engine/rule.ts'
import { isEs5Component, isEs6Component } from './shared/class-components.ts'

/** The kinds of node that open a function, whose returns are their own. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/**
 * Whether a subtree holds a return statement outside any nested function.
 *
 * @param node - The node searched
 * @returns Whether a return belongs to the enclosing function
 */
function hasOwnReturn(node: Node): boolean {
  if (node.kind === 'ReturnStatement') return true
  return childrenOf(node).some((child) => !FUNCTIONS.has(child.kind) && hasOwnReturn(child))
}

/**
 * Whether a function value renders something: an expression-bodied arrow, or a body with its own
 * return.
 *
 * @param value - The function expression or arrow
 * @returns Whether it returns
 */
function returns(value: Node): boolean {
  const body = value.body as Node
  return body.kind !== 'BlockStatement' || hasOwnReturn(body)
}

export default defineRule<undefined, Node>({
  id: 'react/require-render-return',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (members: readonly Node[]): void => {
      for (const member of members) {
        if ((member.key as Node | undefined)?.name !== 'render') continue
        const value = member.value as Node | null
        if (value === null || (value.kind !== 'FunctionExpression' && value.kind !== 'ArrowFunctionExpression') || returns(value)) continue
        context.report({ start: member.start, end: member.end, message: 'Your render method should have a return statement' })
      }
    }
    const checkClass = (node: Node): void => {
      if (isEs6Component(context, node)) check((node.body as Node).body as readonly Node[])
    }
    return {
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
      ObjectExpression(node) {
        if (isEs5Component(context, node)) check(node.properties as readonly Node[])
      },
    }
  },
})
