/**
 * Whether a function gives back a value, as the rules requiring `@returns` decide it: a
 * `return` with an argument outside nested functions, an arrow's expression body, a declared
 * signature's return type other than `void`, `undefined` or `never`; a returned `new Promise`
 * counts only when its executor resolves with a value.
 *
 * @module rules/jsdoc/shared/returns
 */

import type { Node } from '../../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { childrenOf } from '../../../code/children'

/** The return types that give back nothing. */
const NOTHING_TYPES = createSet<string>(['TSVoidKeyword', 'TSUndefinedKeyword', 'TSNeverKeyword'])

/** The statements whose `body` alone is searched for returns. */
const BODIED = createSet<string>([
  'LabeledStatement',
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WithStatement',
])

/** The function kinds, inside which a return belongs to another function. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/**
 * Whether an expression is `new Promise(...)`.
 *
 * @param node - The expression
 * @returns Whether it constructs a promise
 *
 * @example Only a constructed Promise counts
 * ```ts
 * // expressions: new Promise(run), Promise.resolve(1)
 * isNewPromise(constructed) // => true
 * isNewPromise(resolvedCall) // => false
 * ```
 */
export function isNewPromise(node: Node): boolean {
  const callee = node.callee as Node | undefined
  return node.kind === 'NewExpression' && callee?.kind === 'Identifier' && callee.name === 'Promise'
}

/**
 * Whether a `new Promise` names `void` as its type argument.
 *
 * @param node - The `new Promise` expression
 * @returns Whether it promises nothing
 *
 * @example Read the type argument of new Promise
 * ```ts
 * // expressions: new Promise<void>(run), new Promise(run)
 * isVoidPromise(voidPromise) // => true
 * isVoidPromise(untypedPromise) // => false
 * ```
 */
export function isVoidPromise(node: Node): boolean {
  const first = (node.typeArguments?.params as readonly Node[] | undefined)?.[0]
  return first?.kind === 'TSVoidKeyword'
}

/**
 * Whether a node, outside functions that take the resolver as their first parameter, calls the
 * resolver with an argument or passes it on to a call.
 *
 * @param node - The node searched
 * @param resolver - The resolver's name
 * @returns Whether a value may be resolved
 */
function resolvesValue(node: Node, resolver: string): boolean {
  if (FUNCTIONS.has(node.kind) && ((node.params as readonly Node[])[0]?.name as string | undefined) === resolver) return false
  if (node.kind === 'CallExpression') {
    const callee = node.callee as Node
    const args = node.arguments as readonly Node[]
    if (callee.kind === 'Identifier' && callee.name === resolver && args.length > 0) return true
    if (args.some((arg) => arg.kind === 'Identifier' && arg.name === resolver)) return true
  }
  return childrenOf(node).some((child) => resolvesValue(child, resolver))
}

/**
 * Whether a `new Promise` resolves with a value: its executor's first parameter is called with
 * an argument or passed on.
 *
 * @param node - The `new Promise` expression
 * @returns Whether the promise gives a value
 *
 * @example Look for the resolver being called with a value
 * ```ts
 * // new Promise((resolve) => resolve(user))
 * promiseResolvesValue(withUser) // => true
 * // new Promise((resolve) => setTimeout(resolve, 10)), passed on
 * promiseResolvesValue(passedOn) // => true
 * // new Promise((resolve) => resolve())
 * promiseResolvesValue(emptyResolve) // => false
 * ```
 */
export function promiseResolvesValue(node: Node): boolean {
  if (isVoidPromise(node)) return false
  const executor = (node.arguments as readonly Node[])[0]
  const resolver = (executor?.params as readonly Node[] | undefined)?.[0]
  if (resolver?.kind !== 'Identifier') return false
  return resolvesValue((executor as Node).body as Node, resolver.name as string)
}

/** What a search for returns found first: a value, an empty `return`, or neither. */
type Found = 'value' | 'empty' | 'none'

/** How returns are searched. */
interface Search {
  /** Whether an empty `return` met before a value ends the search. */
  readonly strict: boolean
  /** Whether any returned `new Promise` counts as a value, whatever its executor resolves. */
  readonly anyPromise: boolean
}

/**
 * The first finding over statements in order.
 *
 * @param nodes - The statements, nulls for the branches absent
 * @param search - How returns are searched
 * @returns The first finding other than none, or none
 */
function findFirst(nodes: readonly (Node | null | undefined)[], search: Search): Found {
  for (const node of nodes) {
    const found = findReturn(node, search)
    if (found !== 'none') return found
  }
  return 'none'
}

/**
 * Searches a statement for a `return`, nested functions aside.
 *
 * @param node - The statement, or null
 * @param search - How returns are searched
 * @returns What was found first
 */
function findReturn(node: Node | null | undefined, search: Search): Found {
  if (node === null || node === undefined) return 'none'
  if (node.kind === 'BlockStatement') return findFirst(node.body as readonly Node[], search)
  if (BODIED.has(node.kind)) return findReturn(node.body as Node, search)
  if (node.kind === 'IfStatement') return findFirst([node.consequent as Node, node.alternate as Node | null], search)
  if (node.kind === 'TryStatement') {
    const handler = node.handler as Node | null
    return findFirst([node.block as Node, handler?.body as Node | undefined, node.finalizer as Node | null], search)
  }
  if (node.kind === 'SwitchStatement')
    return findFirst(
      (node.cases as readonly Node[]).flatMap((item) => item.consequent as readonly Node[]),
      search
    )
  if (node.kind !== 'ReturnStatement') return 'none'
  const argument = node.argument as Node | null
  if (argument === null) return search.strict ? 'empty' : 'none'
  return !isNewPromise(argument) || search.anyPromise || promiseResolvesValue(argument) ? 'value' : 'none'
}

/**
 * Whether a function's expression body is its value: any expression but a `new Promise<void>`.
 *
 * @param node - The function
 * @returns Whether the body gives a value
 */
function isValueBody(node: Node): boolean {
  const body = node.body as Node
  return node.expression === true && !(isNewPromise(body) && isVoidPromise(body))
}

/**
 * Whether a declared signature names a return type other than `void`, `undefined` or `never`.
 *
 * @param node - The signature
 * @returns Whether it returns a value
 */
function hasAnnotatedValue(node: Node): boolean {
  const annotation = node.returnType?.typeAnnotation as Node | undefined
  return annotation !== undefined && !NOTHING_TYPES.has(annotation.kind)
}

/**
 * Whether a function gives back a value on some path.
 *
 * @param node - The function or declared signature
 * @param anyPromise - Whether any returned `new Promise` counts, whatever its executor resolves
 * @returns Whether a value is returned
 *
 * @example One path with a value is enough
 * ```ts
 * // function find(id) { if (id) return 1 }
 * returnsValue(find) // => true
 * // function wait() { return new Promise((resolve) => resolve()) }
 * returnsValue(wait) // => false
 * returnsValue(wait, true) // => true (any new Promise counts)
 * ```
 */
export function returnsValue(node: Node, anyPromise = false): boolean {
  if (node.kind === 'TSDeclareFunction') return hasAnnotatedValue(node)
  return isValueBody(node) || findReturn(node.body as Node, { strict: false, anyPromise }) === 'value'
}

/**
 * Whether every branch of a statement ends in a `return` with a value or a `throw`, as the
 * previous linter judged it: a block by its last statement, an endless loop by any return in
 * it, a switch by no case breaking or returning empty.
 *
 * @param node - The statement, or null
 * @param search - How returns are searched
 * @returns Whether every branch returns
 */
function everyBranch(node: Node | null | undefined, search: Search): boolean {
  if (node === null || node === undefined) return false
  switch (node.kind) {
    case 'BlockStatement':
      return everyBranch((node.body as readonly Node[]).at(-1), search)
    case 'WhileStatement':
    case 'DoWhileStatement':
    case 'ForStatement': {
      const test = node.test as Node | null
      // why: an endless loop leaves only through a return, so one return in it is enough.
      if (test === null || (node.kind !== 'ForStatement' && test.kind === 'Literal' && test.value === true))
        return findReturn(node.body as Node, { ...search, strict: false }) === 'value'
      return everyBranch(node.body as Node, search)
    }
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'LabeledStatement':
    case 'WithStatement':
      return everyBranch(node.body as Node, search)
    case 'IfStatement':
      return everyBranch(node.consequent as Node, search) && everyBranch(node.alternate as Node | null, search)
    case 'ReturnStatement':
      return findReturn(node, { ...search, strict: false }) === 'value'
    case 'SwitchStatement':
      return (node.cases as readonly Node[]).every((item) =>
        (item.consequent as readonly Node[]).every(
          (statement) => statement.kind !== 'BreakStatement' && !(statement.kind === 'ReturnStatement' && statement.argument === null)
        )
      )
    case 'ThrowStatement':
      return true
    case 'TryStatement':
      return everyTry(node, search)
    default:
      return false
  }
}

/**
 * Whether every branch of a `try` returns: its `finally` does, or its block and handler do and
 * its `finally` holds no empty `return`.
 *
 * @param node - The try statement
 * @param search - How returns are searched
 * @returns Whether every branch returns
 */
function everyTry(node: Node, search: Search): boolean {
  const handler = node.handler as Node | null
  const finalizer = node.finalizer as Node | null
  if (finalizer !== null && everyBranch(finalizer, search)) return true
  return (
    everyBranch(node.block as Node, search) &&
    (handler === null || everyBranch(handler.body as Node, search)) &&
    (finalizer === null || findReturn(finalizer, { ...search, strict: true }) !== 'empty')
  )
}

/**
 * Whether a function returns a value on every path: no empty `return` comes before a value in
 * it, and each branch ends in a return with a value or a throw.
 *
 * @param node - The function or declared signature
 * @param anyPromise - Whether any returned `new Promise` counts, whatever its executor resolves
 * @returns Whether every path returns a value
 *
 * @example A missing else branch fails, a final throw passes
 * ```ts
 * // function pick(a) { if (a) return 1 }
 * returnsOnEveryPath(pick, false) // => false
 * // function pick(a) { if (a) return 1; throw new Error('none') }
 * returnsOnEveryPath(pick, false) // => true
 * // function pick(a) { if (a) return; return 2 }
 * returnsOnEveryPath(pick, false) // => false (an empty return comes first)
 * ```
 */
export function returnsOnEveryPath(node: Node, anyPromise: boolean): boolean {
  if (node.kind === 'TSDeclareFunction') return hasAnnotatedValue(node)
  const search = { strict: true, anyPromise }
  const body = node.body as Node
  if (!isValueBody(node) && findReturn(body, search) !== 'value') return false
  return (
    isValueBody(node) ||
    everyBranch(body, search) ||
    (body.body as readonly Node[]).some((statement) => statement.kind === 'ReturnStatement')
  )
}
