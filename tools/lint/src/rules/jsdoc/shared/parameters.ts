/**
 * A function's parameters as the jsdoc rules name them: a plain name, a rest parameter, or a
 * destructured parameter whose properties and elements are listed as dotted paths under its
 * root, as the previous linter flattened them for `@param` paths such as `options.radix`.
 *
 * @module rules/jsdoc/shared/parameters
 */

import type { Node } from '../../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The types whose destructured properties are documented; any other type documents them elsewhere. */
const OBJECT_TYPES = createSet<string>(['object', 'Object', 'array', 'Array', 'PlainObject', 'GenericObject', 'GenericArray'])

/**
 * Whether a tag's type is a plain object or array type, whose destructured properties need tags.
 *
 * @param type - The tag's type, as written between the braces
 * @returns Whether it names a plain object or array
 */
export function isObjectType(type: string): boolean {
  return OBJECT_TYPES.has(type)
}

/** A name inside a destructuring: a property, an element by index, or a rest. */
export interface Leaf {
  /** Tells the item kinds apart. */
  readonly kind: 'leaf'
  /** The property's name or the element's index. */
  readonly name: string
  /** Whether it is a rest element. */
  readonly restElement: boolean
  /** Whether it is a rest property of an object pattern. */
  readonly restProperty: boolean
}

/** A destructuring nested under a key. */
export interface Branch {
  /** Tells the item kinds apart. */
  readonly kind: 'branch'
  /** The key the nested destructuring sits under, or undefined when the key has no name. */
  readonly key: string | undefined
  /** What it destructures. */
  readonly items: readonly Item[]
}

/** One item of a destructuring: a plain name, a leaf, a branch, or undefined for a key without a name. */
export type Item = string | undefined | Leaf | Branch

/** A destructuring listed as dotted paths. */
export interface Flattened {
  /** The paths, each nested name under its parents. */
  readonly names: readonly string[]
  /** Whether the item at each position was a rest property; positions follow the items, not always the names. */
  readonly rests: readonly boolean[]
  /** Whether a rest property appears anywhere. */
  readonly hasPropertyRest: boolean
  /** Whether a rest element appears anywhere. */
  readonly hasRestElement: boolean
}

/** A parameter named by an identifier. */
export interface NamedParameter {
  /** Tells the parameter kinds apart. */
  readonly kind: 'name'
  /** The name; `this` for a `this` parameter. */
  readonly name: string
}

/** A rest parameter. */
export interface RestParameter {
  /** Tells the parameter kinds apart. */
  readonly kind: 'rest'
  /** The name of the rest identifier, or null when it destructures a tuple. */
  readonly name: string | null
  /** The names of a destructured tuple's elements, or null. */
  readonly elements: readonly (string | undefined)[] | null
}

/** A destructured parameter, or one typed by an inline object type. */
export interface DestructuredParameter {
  /** Tells the parameter kinds apart. */
  readonly kind: 'destructured'
  /** The parameter's own name, when it has one beside its inline type. */
  readonly root: string | undefined
  /** The identifier's name when the inline type annotates an identifier. */
  readonly annotationName: string | undefined
  /** What it destructures, unflattened. */
  readonly items: readonly Item[]
  /** What it destructures, as paths. */
  readonly flat: Flattened
}

/** A parameter as the jsdoc rules read it. */
export type Parameter = NamedParameter | RestParameter | DestructuredParameter

/**
 * Lists destructured items as dotted paths under a root.
 *
 * @param items - The destructured items
 * @param root - The path they sit under, empty at the top
 * @returns The paths and what the items were
 */
export function flatten(items: readonly Item[], root = ''): Flattened {
  const names: string[] = []
  const rests: boolean[] = []
  let hasPropertyRest = false
  let hasRestElement = false
  const under = (name: string | undefined): string | undefined => (root === '' ? name : `${root}.${name}`)
  for (const item of items) {
    if (item === undefined) continue
    if (typeof item === 'string') {
      rests.push(false)
      names.push(under(item) as string)
    } else if (item.kind === 'leaf') {
      rests.push(item.restProperty)
      hasPropertyRest ||= item.restProperty
      hasRestElement ||= item.restElement
      names.push(under(item.name) as string)
    } else {
      const prefix = under(item.key)
      const inner = flatten(item.items, prefix ?? '')
      hasPropertyRest ||= inner.hasPropertyRest
      hasRestElement ||= inner.hasRestElement
      // why: the previous linter recorded the branch's own position even when its key has no name to list.
      rests.push(false, ...inner.rests)
      if (prefix) names.push(prefix)
      names.push(...inner.names)
    }
  }
  return { names, rests, hasPropertyRest, hasRestElement }
}

/**
 * The items an inline object type's members give: a property's name, its nested inline type,
 * nothing for index, call and construct signatures.
 *
 * @param member - The type member
 * @returns A name, a branch for a nested type, or undefined
 */
function memberItem(member: Node): Item {
  if (
    member.kind === 'TSIndexSignature' ||
    member.kind === 'TSCallSignatureDeclaration' ||
    member.kind === 'TSConstructSignatureDeclaration'
  ) {
    return undefined
  }
  const key = (member.key as Node).name as string
  const annotation = member.typeAnnotation?.typeAnnotation as Node | undefined
  if (annotation?.kind === 'TSTypeLiteral') return { kind: 'branch', key, items: (annotation.members as readonly Node[]).map(memberItem) }
  return key
}

/**
 * The leaves of an array pattern: each element by index.
 *
 * @param pattern - The array pattern
 * @param quoted - Whether the indexes are written quoted, as at the top of a parameter
 * @returns The leaves, one per element
 */
function elementLeaves(pattern: Node, quoted: boolean): Leaf[] {
  return (pattern.elements as readonly (Node | null)[]).map((element, index) => ({
    kind: 'leaf',
    name: quoted ? `"${index}"` : `${index}`,
    restElement: element?.kind === 'RestElement',
    restProperty: false,
  }))
}

/**
 * The item a property of an object pattern gives.
 *
 * @param property - The property or rest element
 * @returns A name, a branch for a nested pattern, or undefined
 */
function propertyItem(property: Node): Item {
  if (property.kind === 'RestElement')
    return { kind: 'leaf', name: (property.argument as Node).name as string, restElement: true, restProperty: true }
  const key = property.key as Node
  const keyName = key.name as string | undefined
  let value = property.value as Node
  if (value.kind === 'AssignmentPattern') value = value.left as Node
  if (value.kind === 'ArrayPattern') return { kind: 'branch', key: keyName, items: elementLeaves(value, false) }
  if (value.kind === 'ObjectPattern')
    return { kind: 'branch', key: keyName, items: (value.properties as readonly Node[]).map(propertyItem) }
  if (key.kind === 'Identifier') return keyName
  return key.kind === 'Literal' ? (key.raw as string) : undefined
}

/**
 * Reads one parameter.
 *
 * @param param - The parameter node
 * @returns How the rules name it
 */
function readParameter(param: Node): Parameter {
  if (param.kind === 'TSParameterProperty') return readParameter(param.parameter as Node)
  const left = param.kind === 'AssignmentPattern' ? (param.left as Node) : param
  const annotation = left.typeAnnotation?.typeAnnotation as Node | undefined
  if (annotation?.kind === 'TSTypeLiteral') {
    const items = (annotation.members as readonly Node[]).map(memberItem)
    const root = left.kind === 'Identifier' ? (left.name as string) : undefined
    return { kind: 'destructured', root, annotationName: param.kind === 'Identifier' ? root : undefined, items, flat: flatten(items) }
  }
  if (left.kind === 'Identifier') return { kind: 'name', name: left.name as string }
  if (left.kind === 'ObjectPattern') {
    const items = (left.properties as readonly Node[]).map(propertyItem)
    return { kind: 'destructured', root: undefined, annotationName: undefined, items, flat: flatten(items) }
  }
  if (left.kind === 'ArrayPattern') {
    const items = elementLeaves(left, true)
    return { kind: 'destructured', root: undefined, annotationName: undefined, items, flat: flatten(items) }
  }
  const argument = left.argument as Node
  if (argument.kind === 'Identifier') return { kind: 'rest', name: argument.name as string, elements: null }
  const elements = (argument.elements as readonly (Node | null)[]).map((element) => element?.name as string | undefined)
  return { kind: 'rest', name: null, elements }
}

/**
 * The parameters of a function, a declared signature or a method signature.
 *
 * @param node - The function
 * @returns Its parameters, in order
 */
export function parametersOf(node: Node): Parameter[] {
  return (node.params as readonly Node[]).map(readParameter)
}
