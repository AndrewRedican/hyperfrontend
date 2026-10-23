/**
 * `hasOwnProperty`, `isPrototypeOf` and `propertyIsEnumerable` called on an arbitrary object
 * may be shadowed by the object or absent from one created without a prototype; they are
 * called through `Object.prototype` instead.
 *
 * @module rules/javascript/no-prototype-builtins
 */

import type { Node, TemplateValue } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'

/** The methods of `Object.prototype` the rule guards. */
const DISALLOWED = createSet<string>(['hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable'])

export default defineRule<undefined, Node>({
  id: 'no-prototype-builtins',
  language: 'code',
  fixable: false,
  create: (context) => ({
    CallExpression(node) {
      let callee = node.callee as Node
      if (callee.kind === 'ChainExpression') callee = callee.expression as Node
      if (callee.kind !== 'MemberExpression') return
      const name = staticPropertyName(callee)
      if (name === null || !DISALLOWED.has(name)) return
      const property = callee.property as Node
      context.report({
        start: property.start,
        end: property.end,
        message: `Do not access Object.prototype method '${name}' from target object.`,
      })
    },
  }),
})

/**
 * The name a member expression accesses when it is fixed: a plain identifier, a literal or a
 * template without substitutions.
 *
 * @param member - The member expression read
 * @returns The property name, or null when it is computed from a value
 */
function staticPropertyName(member: Node): string | null {
  const property = member.property as Node
  if (member.computed !== true) return property.kind === 'Identifier' ? (property.name as string) : null
  if (property.kind === 'Literal') return property.regex === undefined && property.value === null ? 'null' : String(property.value)
  if (property.kind !== 'TemplateLiteral' || (property.expressions as readonly Node[]).length > 0) return null
  const [quasi] = property.quasis as readonly Node[]
  return ((quasi as Node).value as TemplateValue).cooked
}
