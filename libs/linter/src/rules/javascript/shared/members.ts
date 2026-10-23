/**
 * Reading member accesses the way rules name them: the node an optional chain wraps, the name a
 * property is accessed by when it is written out, and whether an access is `object.property`.
 *
 * @module rules/javascript/shared/members
 */

import type { Node, TemplateValue } from '../../../code/model'

/**
 * The expression a chain wraps, or the node itself when it is no chain.
 *
 * @param node - The node looked at
 * @returns The node with a `ChainExpression` around it removed
 *
 * @example Look through an optional chain
 * ```ts
 * // expression: user?.name
 * expression.kind // => 'ChainExpression'
 * skipChain(expression).kind // => 'MemberExpression'
 * ```
 */
export function skipChain(node: Node): Node {
  return node.kind === 'ChainExpression' ? (node.expression as Node) : node
}

/**
 * The name a member expression accesses when it is written out: `a.b`, `a['b']`, `a[\`b\`]` or
 * `a[1]` name `b`, `b`, `b` and `1`; `a[b]` names nothing static.
 *
 * @param member - The member expression read
 * @returns The property name, or null when it is computed from a value
 *
 * @example Name the property of each access form
 * ```ts
 * // members: config.port, config['port'], list[0], config[key]
 * members.map(staticPropertyName) // => ['port', 'port', '0', null]
 * ```
 */
export function staticPropertyName(member: Node): string | null {
  const property = member.property as Node
  if (member.computed !== true) return property.kind === 'Identifier' ? (property.name as string) : null
  if (property.kind === 'Literal') return property.value === null ? null : `${property.value as string}`
  if (property.kind !== 'TemplateLiteral' || (property.expressions as readonly Node[]).length > 0) return null
  return (((property.quasis as readonly Node[])[0] as Node).value as TemplateValue).cooked
}

/**
 * Whether a node is a member access with a given static property name and, when one is asked
 * for, a given identifier as its object; an optional chain around it is looked through.
 *
 * @param node - The node tested
 * @param objectName - The identifier the object must be, or null for any object
 * @param propertyName - The property name the access must have
 * @returns Whether the node is that access
 *
 * @example Match Object.keys however it is written
 * ```ts
 * // expressions: Object.keys, Object?.['keys'], Reflect.keys
 * isMemberAccess(objectKeys, 'Object', 'keys') // => true
 * isMemberAccess(optionalObjectKeys, 'Object', 'keys') // => true
 * isMemberAccess(reflectKeys, 'Object', 'keys') // => false
 * isMemberAccess(reflectKeys, null, 'keys') // => true (any object)
 * ```
 */
export function isMemberAccess(node: Node, objectName: string | null, propertyName: string): boolean {
  const member = skipChain(node)
  if (member.kind !== 'MemberExpression') return false
  const object = member.object as Node
  if (objectName !== null && (object.kind !== 'Identifier' || object.name !== objectName)) return false
  return staticPropertyName(member) === propertyName
}
