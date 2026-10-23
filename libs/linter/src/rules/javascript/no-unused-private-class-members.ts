/**
 * A private field, method or accessor that the class never reads is dead code; writing to it,
 * incrementing it as a statement or assigning it in a pattern does not count as reading.
 *
 * @module rules/javascript/no-unused-private-class-members
 */

import type { Node } from '../../code/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule'

/** A private member of the class being read. */
interface Member {
  /** The member's private name, where the report sits. */
  readonly key: Node
  /** Whether it is a getter or setter, whose every use may run code. */
  readonly accessor: boolean
  /** Whether something has read it. */
  used: boolean
}

export default defineRule<undefined, Node>({
  id: 'no-unused-private-class-members',
  language: 'code',
  fixable: false,
  create(context) {
    // how: the classes open at this point, innermost first; a private name resolves to the nearest class declaring it.
    const classes: Map<string, Member>[] = []
    return {
      ClassBody(node) {
        const members = createMap<string, Member>()
        for (const member of node.body as readonly Node[]) {
          if (member.kind !== 'PropertyDefinition' && member.kind !== 'MethodDefinition') continue
          const key = member.key as Node
          if (key.kind !== 'PrivateIdentifier') continue
          const accessor = member.kind === 'MethodDefinition' && (member.methodKind === 'get' || member.methodKind === 'set')
          members.set(key.name as string, { key, accessor, used: false })
        }
        classes.unshift(members)
      },
      'ClassBody:exit'() {
        for (const member of (classes.shift() as Map<string, Member>).values()) {
          if (member.used) continue
          const key = member.key
          context.report({ start: key.start, end: key.end, message: `'#${key.name as string}' is defined but never used.` })
        }
      },
      PrivateIdentifier(node) {
        const name = node.name as string
        const members = classes.find((candidates) => candidates.has(name))
        if (members === undefined) return
        const member = members.get(name) as Member
        const parent = node.parent as Node
        if (member.used || parent.kind === 'PropertyDefinition' || parent.kind === 'MethodDefinition') return
        if (member.accessor) {
          member.used = true
          return
        }
        if (isWriteOnly(node)) return
        const wrapper = parent.parent as Node
        const outer = wrapper.parent as Node
        if (wrapper.kind === 'UpdateExpression' && outer.kind === 'ExpressionStatement') return
        if (wrapper.kind === 'Property' && outer.kind === 'ObjectPattern' && wrapper.value === parent) return
        if (wrapper.kind === 'RestElement' || wrapper.kind === 'ArrayPattern') return
        member.used = true
      },
    }
  },
})

/**
 * Whether a private member access is only assigned to: the left side of `=`, of a loop head or
 * of a default in a pattern, or of a compound assignment that is a statement of its own.
 *
 * @param name - The private name in the access
 * @returns Whether the access reads nothing
 */
function isWriteOnly(name: Node): boolean {
  const access = name.parent as Node
  const target = access.parent as Node
  const assignment = target.kind === 'AssignmentExpression'
  if (!assignment && target.kind !== 'ForInStatement' && target.kind !== 'ForOfStatement' && target.kind !== 'AssignmentPattern')
    return false
  if (target.left !== access) return false
  if (assignment && target.operator !== '=') return (target.parent as Node).kind === 'ExpressionStatement'
  return true
}
