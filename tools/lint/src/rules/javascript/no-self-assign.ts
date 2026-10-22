/**
 * Assigning a variable or a property to itself does nothing; it is a typo or a leftover of an
 * edit. Destructuring is read element by element and property by property.
 *
 * @module rules/javascript/no-self-assign
 */

import type { Node, TemplateValue } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'

/** What a rule does with a node assigned to itself. */
type Reporter = (node: Node) => void

/** The assignments that store the right side as it is. */
const PLAIN_ASSIGNMENTS = createSet<string>(['=', '&&=', '||=', '??='])

export default defineRule<undefined, Node>({
  id: 'no-self-assign',
  language: 'code',
  fixable: false,
  create(context) {
    const report: Reporter = (node) => {
      const name = context.file.text.slice(node.start, node.end).replace(/\s+/g, '')
      context.report({ start: node.start, end: node.end, message: `'${name}' is assigned to itself.` })
    }
    return {
      AssignmentExpression(node) {
        if (PLAIN_ASSIGNMENTS.has(node.operator as string)) compare(node.left as Node, node.right as Node, report)
      },
    }
  },
})

/**
 * Reports a target assigned its own value, reading through array and object destructuring.
 *
 * @param target - What is assigned, or null for a hole
 * @param value - What is assigned to it, or null for a hole
 * @param report - Reports a value that is its own target
 */
function compare(target: Node | null, value: Node | null, report: Reporter): void {
  if (target === null || value === null) return
  if (target.kind === 'Identifier' && value.kind === 'Identifier') {
    if (target.name === value.name) report(value)
  } else if (target.kind === 'ArrayPattern' && value.kind === 'ArrayExpression') {
    compareElements(target.elements as readonly (Node | null)[], value.elements as readonly (Node | null)[], report)
  } else if (target.kind === 'RestElement' && value.kind === 'SpreadElement') {
    compare(target.argument as Node, value.argument as Node, report)
  } else if (target.kind === 'ObjectPattern' && value.kind === 'ObjectExpression') {
    compareProperties(target.properties as readonly Node[], value.properties as readonly Node[], report)
  } else if (target.kind === 'Property' && value.kind === 'Property') {
    if (value.propertyKind !== 'init' || value.method === true) return
    const name = staticName(target)
    if (name !== null && name === staticName(value)) compare(target.value as Node, value.value as Node, report)
  } else if (isSameReference(target, value)) report(value)
}

/**
 * Compares the elements of an array pattern with those of an array literal, position by position.
 *
 * @param targets - The pattern's elements
 * @param values - The literal's elements
 * @param report - Reports a value that is its own target
 */
function compareElements(targets: readonly (Node | null)[], values: readonly (Node | null)[], report: Reporter): void {
  for (let index = 0; index < targets.length && index < values.length; index += 1) {
    const target = targets[index] as Node | null
    const value = values[index] as Node | null
    // why: a rest target takes every remaining value, so it matches one value only when that value is the last.
    if (target !== null && target.kind === 'RestElement' && index < values.length - 1) return
    compare(target, value, report)
    // why: after a spread the positions of the values that follow are unknown.
    if (value !== null && value.kind === 'SpreadElement') return
  }
}

/**
 * Compares the properties of an object pattern with those of an object literal, by name.
 *
 * @param targets - The pattern's properties
 * @param values - The literal's properties
 * @param report - Reports a value that is its own target
 */
function compareProperties(targets: readonly Node[], values: readonly Node[], report: Reporter): void {
  // why: a spread may overwrite every property before it, so only the ones after the last spread are known.
  let first = 0
  values.forEach((value, index) => {
    if (value.kind === 'SpreadElement') first = index + 1
  })
  for (const target of targets) {
    for (let index = first; index < values.length; index += 1) compare(target, values[index] as Node, report)
  }
}

/**
 * The name a property or member expression reads statically: an identifier key that is not
 * computed, or the text of a literal or substitution-free template key.
 *
 * @param owner - The property or member expression
 * @returns The name, or null when it is computed from a value
 */
function staticName(owner: Node): string | null {
  const key = (owner.kind === 'MemberExpression' ? owner.property : owner.key) as Node
  if (key.kind === 'Identifier') return owner.computed === true ? null : (key.name as string)
  if (key.kind === 'TemplateLiteral') {
    if ((key.expressions as readonly Node[]).length > 0) return null
    return (((key.quasis as readonly Node[])[0] as Node).value as TemplateValue).cooked
  }
  if (key.kind !== 'Literal') return null
  if (key.regex !== undefined) return `/${key.regex.pattern}/${key.regex.flags}`
  if (key.bigint !== undefined) return key.bigint
  return `${key.value as string | number | boolean | null}`
}

/**
 * Whether two expressions name the same variable or property, reading `a?.b` as `a.b` and a
 * member by its static name when it has one.
 *
 * @param left - One expression
 * @param right - The other
 * @returns Whether both read the same place
 */
function isSameReference(left: Node, right: Node): boolean {
  if (left.kind === 'ChainExpression') return isSameReference(left.expression as Node, right)
  if (right.kind === 'ChainExpression') return isSameReference(left, right.expression as Node)
  if (left.kind !== right.kind) return false
  if (left.kind === 'Super' || left.kind === 'ThisExpression') return true
  if (left.kind === 'Identifier' || left.kind === 'PrivateIdentifier') return left.name === right.name
  if (left.kind !== 'MemberExpression') return false
  const name = staticName(left)
  if (name !== null) return isSameReference(left.object as Node, right.object as Node) && name === staticName(right)
  return (
    left.computed === right.computed &&
    isSameReference(left.object as Node, right.object as Node) &&
    isSameReference(left.property as Node, right.property as Node)
  )
}
