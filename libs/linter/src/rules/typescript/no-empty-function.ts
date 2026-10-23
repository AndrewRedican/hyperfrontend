/**
 * A function whose block body holds neither a statement nor a comment is either unfinished
 * or a stand-in that should say so; the empty block is reported, named by the function's kind
 * and name. A constructor that declares parameter properties has a body's worth of work in its
 * parameter list and passes.
 *
 * @module rules/typescript/no-empty-function
 */

import type { Node, TemplateValue } from '../../code/model'
import { commentsBetween } from '../../code/source'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'typescript/no-empty-function',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (node: Node): void => {
      const body = node.body as Node
      if (body.kind !== 'BlockStatement' || (body.body as readonly Node[]).length > 0) return
      if (commentsBetween(context.file, body.start, body.end).length > 0) return
      if (isConstructorWithParameterProperties(node)) return
      context.report({ start: body.start, end: body.end, message: `Unexpected empty ${describe(node)}.` })
    }
    return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check }
  },
})

/**
 * Whether a function is a constructor with at least one parameter property.
 *
 * @param node - The function
 * @returns Whether its empty body still declares and assigns members
 */
function isConstructorWithParameterProperties(node: Node): boolean {
  const parent = node.parent as Node
  if (parent.kind !== 'MethodDefinition' || parent.methodKind !== 'constructor') return false
  return (node.params as readonly Node[]).some((param) => param.kind === 'TSParameterProperty')
}

/**
 * Names a function the way a reader would: its modifiers, its kind and its name.
 *
 * @param node - The function
 * @returns A phrase such as `async arrow function`, `static method 'run'` or `constructor`
 */
function describe(node: Node): string {
  const parent = node.parent as Node
  const member = parent.kind === 'MethodDefinition' || parent.kind === 'PropertyDefinition'
  const keyed = member || parent.kind === 'Property'
  const privateKey = keyed && parent.computed !== true && (parent.key as Node).kind === 'PrivateIdentifier'
  const words: string[] = []
  if (member && parent.static === true) words.push('static')
  if (privateKey) words.push('private')
  if (node.async === true) words.push('async')
  if (node.generator === true) words.push('generator')
  const kind = parent.kind === 'Property' ? parent.propertyKind : parent.methodKind
  if (keyed && kind === 'constructor') return 'constructor'
  if (keyed) words.push(kind === 'get' ? 'getter' : kind === 'set' ? 'setter' : 'method')
  else words.push(node.kind === 'ArrowFunctionExpression' ? 'arrow function' : 'function')
  const name = keyed ? (privateKey ? `#${(parent.key as Node).name as string}` : quotedKeyName(parent)) : null
  const id = node.id as Node | null | undefined
  if (name !== null) words.push(name)
  else if (id !== null && id !== undefined) words.push(`'${id.name as string}'`)
  return words.join(' ')
}

/**
 * The name a member's key states, quoted, when it is known without evaluation.
 *
 * @param parent - The method definition, property definition or object property
 * @returns The quoted name, or null for a computed key that is not a literal
 */
function quotedKeyName(parent: Node): string | null {
  const name = staticKeyName(parent.key as Node, parent.computed === true)
  return name === null ? null : `'${name}'`
}

/**
 * The text a key names statically: an uncomputed identifier, a literal or a template without
 * substitutions.
 *
 * @param key - The member's key node
 * @param computed - Whether the key is computed
 * @returns The name, or null when the key is evaluated at runtime
 */
function staticKeyName(key: Node, computed: boolean): string | null {
  if (key.kind === 'Identifier') return computed ? null : (key.name as string)
  if (key.kind === 'Literal') {
    const regex = key.regex
    return regex === undefined ? String(key.value) : `/${regex.pattern}/${regex.flags}`
  }
  if (key.kind === 'TemplateLiteral' && (key.expressions as readonly Node[]).length === 0) {
    return (((key.quasis as readonly Node[])[0] as Node).value as TemplateValue).cooked
  }
  return null
}
