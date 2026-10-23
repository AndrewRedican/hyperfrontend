/**
 * The dependency model of the effect and memo hooks: the property path a reference depends
 * on, the comparison of the paths a callback uses with the paths its array declares, and the
 * kinds of expression that build a new value on every render.
 *
 * @module rules/react-hooks/shared/dependencies
 */

import type { Node } from '../../../code/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** One property path of the dependency tree and what is known of it. */
interface PathNode {
  /** Whether the callback uses the path itself. */
  used: boolean
  /** Whether the array declares the path, or it is stable, so everything under it is covered. */
  satisfied: boolean
  /** Whether the callback uses a path under it. */
  subtreeUsed: boolean
  /** The paths one property deeper, by property name. */
  readonly children: Map<string, PathNode>
}

/** What a callback uses and its array declares, to compare. */
export interface DependencyInput {
  /** The paths the callback uses, in the order first used. */
  readonly used: Iterable<string>
  /** The paths the array declares, in order. */
  readonly declared: readonly string[]
  /** The used paths known not to change between renders. */
  readonly stable: ReadonlySet<string>
  /** The declared paths whose root is declared outside the component. */
  readonly external: ReadonlySet<string>
  /** Whether the hook is an effect, which may declare more than it uses. */
  readonly isEffect: boolean
}

/** The outcome of comparing what a callback uses with what its array declares. */
export interface Recommendation {
  /** The array as it should read: the needed declared paths, then the missing ones. */
  readonly suggested: string[]
  /** The declared paths nothing needs. */
  readonly unnecessary: Set<string>
  /** The declared paths declared more than once. */
  readonly duplicate: Set<string>
  /** The used paths nothing declared covers. */
  readonly missing: Set<string>
}

/**
 * An empty path node.
 *
 * @returns A node nothing uses or declares yet
 */
function pathNode(): PathNode {
  return { used: false, satisfied: false, subtreeUsed: false, children: createMap<string, PathNode>() }
}

/**
 * The node for a dotted path, creating the nodes on the way.
 *
 * @param root - The tree's root
 * @param path - The dotted path
 * @returns The path's node
 */
function nodeAt(root: PathNode, path: string): PathNode {
  let node = root
  for (const key of path.split('.')) {
    let child = node.children.get(key)
    if (child === undefined) {
      child = pathNode()
      node.children.set(key, child)
    }
    node = child
  }
  return node
}

/**
 * Compares what a callback uses with what its array declares.
 *
 * @param input - The used, declared, stable and external paths and the hook's kind
 * @returns The suggested array and the missing, unnecessary and duplicate paths
 *
 * @example A declared parent path covers what is used under it
 * ```ts
 * recommend({
 *   used: ['user.id', 'setName'],
 *   declared: ['user', 'user', 'theme'],
 *   stable: new Set(['setName']),
 *   external: new Set(),
 *   isEffect: false,
 * })
 * // => { suggested: ['user'], unnecessary: Set { 'theme' },
 * //      duplicate: Set { 'user' }, missing: Set {} }
 * ```
 */
export function recommend(input: DependencyInput): Recommendation {
  const root = pathNode()
  for (const path of input.used) {
    nodeAt(root, path).used = true
    let node = root
    for (const key of path.split('.')) {
      node = node.children.get(key) as PathNode
      node.subtreeUsed = true
    }
  }
  for (const path of input.declared) nodeAt(root, path).satisfied = true
  for (const path of input.stable) nodeAt(root, path).satisfied = true
  const missing = createSet<string>()
  const satisfying = createSet<string>()
  const scan = (node: PathNode, prefix: string): void => {
    for (const [key, child] of node.children) {
      const path = prefix === '' ? key : `${prefix}.${key}`
      if (child.satisfied) {
        if (child.subtreeUsed) satisfying.add(path)
      } else if (child.used) missing.add(path)
      else scan(child, path)
    }
  }
  scan(root, '')
  const suggested: string[] = []
  const unnecessary = createSet<string>()
  const duplicate = createSet<string>()
  for (const key of input.declared) {
    if (satisfying.has(key)) {
      if (suggested.includes(key)) duplicate.add(key)
      else suggested.push(key)
    } else if (input.isEffect && !key.endsWith('.current') && !input.external.has(key)) {
      if (!suggested.includes(key)) suggested.push(key)
    } else {
      unnecessary.add(key)
    }
  }
  suggested.push(...missing)
  return { suggested, unnecessary, duplicate, missing }
}

/**
 * The dotted property path an expression reads: an identifier, or a chain of plain member
 * reads off one. With a record of optional reads, it notes for each path whether every read
 * of it was optional.
 *
 * @param node - The expression
 * @param optional - Whether each path was only read optionally, updated in place, or null
 * @returns The path, or null for any other expression
 *
 * @example Read a path and note which reads were optional
 * ```ts
 * const optional = new Map<string, boolean>()
 * propertyPathOf(userNameRead, optional) // props.user?.name => 'props.user.name'
 * optional.get('props.user.name') // => true
 * optional.get('props.user') // => false
 * propertyPathOf(firstItemRead, null) // items[0] => null (computed)
 * ```
 */
export function propertyPathOf(node: Node, optional: Map<string, boolean> | null): string | null {
  if (node.kind === 'Identifier' || node.kind === 'JSXIdentifier') {
    optional?.set(node.name as string, false)
    return node.name as string
  }
  let member = node
  if (node.kind === 'ChainExpression') {
    member = node.expression as Node
    if (member.kind === 'CallExpression') return null
  } else if (node.kind !== 'MemberExpression' || node.computed === true) {
    return null
  }
  const object = propertyPathOf(member.object as Node, optional)
  const property = propertyPathOf(member.property as Node, null)
  if (object === null || property === null) return null
  const path = `${object}.${property}`
  if (optional !== null) {
    if (member.optional !== true) optional.set(path, false)
    else if (!optional.has(path)) optional.set(path, true)
  }
  return path
}

/**
 * The expression a reference makes its callback depend on: the longest chain of plain member
 * reads it starts, short of `.current` and of a method call's callee; for the target of an
 * assignment, the object assigned into.
 *
 * @param node - The identifier referenced
 * @returns The expression depended on
 *
 * @example Stop short of a method call and of current
 * ```ts
 * // the props identifier in props.user.save()
 * dependencyOf(props) // => the props.user member expression
 * // the ref identifier in ref.current.focus
 * dependencyOf(ref) // => ref itself
 * // the form identifier in form.values.email = value
 * dependencyOf(form) // => the form.values member expression
 * ```
 */
export function dependencyOf(node: Node): Node {
  const parent = node.parent as Node
  if (parent.kind === 'MemberExpression' && parent.object === node && parent.computed !== true) {
    const grand = parent.parent as Node
    const called = grand.kind === 'CallExpression' && grand.callee === parent
    if ((parent.property as Node).name !== 'current' && !called) return dependencyOf(parent)
  }
  if (node.kind === 'MemberExpression' && parent.kind === 'AssignmentExpression' && parent.left === node) return node.object as Node
  return node
}

/**
 * The kind of value an initialiser builds anew on every render, in the words the messages use.
 *
 * @param node - The initialiser
 * @returns The kind, or null when the value can stay the same
 *
 * @example Name what a fresh value on every render is
 * ```ts
 * // initialisers: { retry: 3 }, cache || new Map(), flag ? a : b
 * constructionKindOf(objectLiteral) // => 'object'
 * constructionKindOf(cachedOrNew) // => 'logical expression'
 * constructionKindOf(eitherValue) // => null (both branches may be stable)
 * ```
 */
export function constructionKindOf(node: Node): string | null {
  switch (node.kind) {
    case 'ObjectExpression':
      return 'object'
    case 'ArrayExpression':
      return 'array'
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return 'function'
    case 'ClassExpression':
      return 'class'
    case 'ConditionalExpression':
      return constructionKindOf(node.consequent as Node) !== null || constructionKindOf(node.alternate as Node) !== null
        ? 'conditional'
        : null
    case 'LogicalExpression':
      return constructionKindOf(node.left as Node) !== null || constructionKindOf(node.right as Node) !== null ? 'logical expression' : null
    case 'JSXFragment':
      return 'JSX fragment'
    case 'JSXElement':
      return 'JSX element'
    case 'AssignmentExpression':
      return constructionKindOf(node.right as Node) === null ? null : 'assignment expression'
    case 'NewExpression':
      return 'object construction'
    case 'Literal':
      return node.regex === undefined ? null : 'regular expression'
    case 'TSAsExpression':
      return constructionKindOf(node.expression as Node)
    default:
      return null
  }
}

/**
 * Joins names into an English list: `a`, `a and b`, `a, b, and c`.
 *
 * @param names - The names, already quoted
 * @returns The list
 *
 * @example Join quoted names with a serial comma
 * ```ts
 * joinEnglish(["'id'", "'name'"]) // => "'id' and 'name'"
 * joinEnglish(["'id'", "'name'", "'email'"]) // => "'id', 'name', and 'email'"
 * ```
 */
export function joinEnglish(names: readonly string[]): string {
  if (names.length === 2) return `${names[0] as string} and ${names[1] as string}`
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1] as string}`
}
