/**
 * When a rule requiring documentation lets a function go: a block or its class's block that
 * ignores, overrides or implements says the docs live elsewhere, an inherited block says the
 * same, and a rule may pass over constructors, getters or setters.
 *
 * @module rules/jsdoc/shared/exemptions
 */

import type { Node } from '../../../code/model'
import type { RuleContext } from '../../../engine/rule'
import type { JsdocBlock } from '../../../jsdoc/parse'
import { jsdocOf } from '../../../jsdoc/attach'

/** Which kinds of accessor and constructor a rule checks. */
export interface AccessorChecks {
  /** Whether constructors are checked. */
  readonly checkConstructors: boolean
  /** Whether getters are checked. */
  readonly checkGetters: boolean
  /** Whether setters are checked. */
  readonly checkSetters: boolean
}

/** The tags that, in a block or its class's block, say the documentation lives elsewhere. */
const REPLACING = ['ignore', 'override', 'implements']

/** The tags that say the block inherits its documentation. */
const INHERITING = ['inheritDoc', 'inheritdoc']

/**
 * Whether a block carries any of the given tags.
 *
 * @param block - The block searched
 * @param names - The tag names looked for, without `@`
 * @returns Whether one of them is present
 *
 * @example Look for a tag that hands the docs elsewhere
 * ```ts
 * // overridden has an override tag; plain has only a description
 * hasTag(overridden, ['ignore', 'override']) // => true
 * hasTag(plain, ['ignore', 'override']) // => false
 * ```
 */
export function hasTag(block: JsdocBlock, names: readonly string[]): boolean {
  return block.tags.some((tag) => names.includes(tag.tag))
}

/**
 * The nearest class around a node.
 *
 * @param node - The node whose ancestors are searched
 * @returns The class declaration or expression, or null
 *
 * @example Climb from a method to its class
 * ```ts
 * // program: class Store { write() {} } / function loose() {}
 * enclosingClass(writeMethod.value) // => the Store ClassDeclaration
 * enclosingClass(looseFunction) // => null
 * ```
 */
export function enclosingClass(node: Node): Node | null {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.kind === 'ClassDeclaration' || current.kind === 'ClassExpression') return current
  }
  return null
}

/**
 * The block documenting the nearest class around a node.
 *
 * @param context - The rule's context
 * @param node - The node whose class is documented
 * @returns The class's block, or null
 *
 * @example Read the block of the class around a method
 * ```ts
 * // the Store class block carries an interface tag
 * classBlockOf(context, writeMethod.value)?.tags.map(({ tag }) => tag)
 * // => ['interface']
 * classBlockOf(context, looseFunction) // => null (no class around it)
 * ```
 */
export function classBlockOf(context: RuleContext<unknown, Node>, node: Node): JsdocBlock | null {
  const owner = enclosingClass(node)
  return owner === null ? null : jsdocOf(context, owner)
}

/**
 * What kind of member a function is: a constructor, a getter, a setter, or none of these.
 *
 * @param node - The function
 * @returns `constructor`, `get`, `set`, or null
 *
 * @example Name the member kind of each method's function
 * ```ts
 * // class Store { constructor() {} get size() {} write() {} }
 * memberKindOf(constructorMethod.value) // => 'constructor'
 * memberKindOf(sizeGetter.value) // => 'get'
 * memberKindOf(writeMethod.value) // => null
 * ```
 */
export function memberKindOf(node: Node): string | null {
  const parent = node.parent as Node
  const kind = parent.kind === 'MethodDefinition' ? parent.methodKind : parent.kind === 'Property' ? parent.propertyKind : null
  return kind === 'constructor' || kind === 'get' || kind === 'set' ? kind : null
}

/**
 * Whether a function's documentation is not required: the block or the class's block replaces
 * it, the block inherits it, or the function is a member kind the rule passes over.
 *
 * @param context - The rule's context
 * @param node - The function documented
 * @param block - Its block
 * @param checks - Which member kinds the rule checks
 * @returns Whether the rule lets the function go
 *
 * @example Let constructors and inherited docs go
 * ```ts
 * const checks = { checkConstructors: false, checkGetters: true, checkSetters: true }
 * avoidsDocs(context, constructorMethod.value, constructorBlock, checks) // => true
 * // readBlock carries inheritDoc
 * avoidsDocs(context, readMethod.value, readBlock, checks) // => true
 * avoidsDocs(context, sizeGetter.value, sizeBlock, checks) // => false
 * ```
 */
export function avoidsDocs(context: RuleContext<unknown, Node>, node: Node, block: JsdocBlock, checks: AccessorChecks): boolean {
  if (hasTag(block, REPLACING)) return true
  const owner = classBlockOf(context, node)
  if (owner !== null && hasTag(owner, REPLACING)) return true
  const kind = memberKindOf(node)
  if (
    (kind === 'constructor' && !checks.checkConstructors) ||
    (kind === 'get' && !checks.checkGetters) ||
    (kind === 'set' && !checks.checkSetters)
  ) {
    return true
  }
  return hasTag(block, INHERITING)
}

/** The tags saying a block documents no implementation whose returns or yields can be checked. */
const UNIMPLEMENTED = ['abstract', 'virtual', 'class', 'constructor', 'interface']

/**
 * Whether a function has no implementation to check against its block: the block says it is
 * abstract, a class or an interface, it is a constructor, or its class is documented as an
 * interface.
 *
 * @param context - The rule's context
 * @param node - The function
 * @param block - Its block
 * @returns Whether its body is not checked
 *
 * @example Skip an abstract method's body
 * ```ts
 * // class Cache { clear() {} read() {} }, clear's block tagged abstract
 * isUnimplemented(context, clearMethod.value, clearBlock) // => true
 * isUnimplemented(context, readMethod.value, readBlock) // => false
 * ```
 */
export function isUnimplemented(context: RuleContext<unknown, Node>, node: Node, block: JsdocBlock): boolean {
  if (hasTag(block, UNIMPLEMENTED) || memberKindOf(node) === 'constructor') return true
  const owner = classBlockOf(context, node)
  return owner !== null && hasTag(owner, ['interface'])
}
