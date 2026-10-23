/**
 * Assigning to `this.state`, or to anything under it, or updating it in place inside a class
 * component bypasses `setState`; it is reported, except directly in the constructor where the
 * state is set up (a callback passed to a call there runs later and is reported).
 *
 * @module rules/react/no-direct-mutation-state
 */

import type { Node } from '../../code/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule'
import { parentEs5Component, parentEs6Component } from './shared/class-components'

/** Where in a component the traversal is. */
interface Position {
  /** Whether it is inside the constructor. */
  inConstructor: boolean
  /** Whether it is inside a call's arguments, as last entered or left. */
  inCall: boolean
}

/** The message reported. */
const MESSAGE = 'Do not mutate state directly. Use setState().'

/**
 * The outermost member a member chain starts from: the member whose object has no property.
 *
 * @param member - The member expression
 * @returns The member right above the chain's root object
 */
function outermost(member: Node): Node {
  let current = member
  while ((current.object as Node).property !== undefined) current = current.object as Node
  return current
}

/**
 * Whether a member is `this.state`.
 *
 * @param member - The member checked
 * @returns Whether it reads the component's state
 */
function isThisState(member: Node): boolean {
  return (member.object as Node).kind === 'ThisExpression' && (member.property as Node).name === 'state'
}

export default defineRule<undefined, Node>({
  id: 'react/no-direct-mutation-state',
  language: 'code',
  fixable: false,
  create(context) {
    const positions = createMap<Node, Position>()
    const positionOf = (node: Node): Position | null => {
      const component = parentEs6Component(context, node) ?? parentEs5Component(context, node)
      if (component === null) return null
      let position = positions.get(component)
      if (position === undefined) {
        position = { inConstructor: false, inCall: false }
        positions.set(component, position)
      }
      return position
    }
    const isChecked = (node: Node): boolean => {
      const position = positionOf(node)
      return position !== null && (!position.inConstructor || position.inCall)
    }
    const enterConstructor = (node: Node, inside: boolean): void => {
      const position = node.methodKind === 'constructor' ? positionOf(node) : null
      if (position !== null) position.inConstructor = inside
    }
    const call = (node: Node, inside: boolean): void => {
      const position = positionOf(node)
      if (position !== null) position.inCall = inside
    }
    return {
      MethodDefinition: (node) => enterConstructor(node, true),
      'MethodDefinition:exit': (node) => enterConstructor(node, false),
      CallExpression: (node) => call(node, true),
      'CallExpression:exit': (node) => call(node, false),
      AssignmentExpression(node) {
        const left = node.left as Node
        if (left.kind !== 'MemberExpression' || !isThisState(outermost(left)) || !isChecked(node)) return
        const target = left.object as Node
        context.report({ start: target.start, end: target.end, message: MESSAGE })
      },
      UpdateExpression(node) {
        const argument = node.argument as Node
        if (argument.kind !== 'MemberExpression') return
        const target = outermost(argument)
        if (!isThisState(target) || !isChecked(node)) return
        context.report({ start: target.start, end: target.end, message: MESSAGE })
      },
    }
  },
})
