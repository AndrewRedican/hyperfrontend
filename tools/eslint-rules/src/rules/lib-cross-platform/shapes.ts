import type { TSESTree } from '@typescript-eslint/utils'
import type { BindingContext } from './bindings'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { methodName, receiverOf, regexOf, stringValue, unwrap } from './ast'
import { referenceOf } from './bindings'

/**
 * How a call turns a path into forward-slash form.
 *
 * - `canonical`: `p.split(sep).join(posix.sep)`, a no-op on POSIX.
 * - `legacy`: any other spelling of native-to-POSIX, which also rewrites backslashes that are
 *   legal in POSIX file names.
 * - `normalizing`: splits on both separators, for input whose platform is unknown.
 */
export type ConversionShape = 'canonical' | 'legacy' | 'normalizing'

/**
 * Regex sources that match either separator, with or without a quantifier.
 */
const SEPARATOR_CLASSES: readonly string[] = ['[\\\\/]', '[/\\\\]', '[\\\\\\/]', '[\\/\\\\]']

/**
 * Tells whether a node reads `sep` from `node:path` or from `node:path/posix`.
 *
 * @param node - The node to inspect, or undefined.
 * @param binding - The file being linted.
 * @returns `native` for the OS separator, `portable` for the POSIX one, null otherwise.
 */
export function separatorFlavour(node: TSESTree.Node | undefined, binding: BindingContext): 'native' | 'portable' | null {
  const reference = node ? referenceOf(node, binding) : null
  if (reference?.name !== 'sep') return null
  if (reference.module === 'path') return 'native'
  return reference.module === 'path/posix' ? 'portable' : null
}

/**
 * Tests whether a node is the string `/`.
 *
 * @param node - The node to test, or undefined.
 * @returns True for a constant `/`.
 */
export function isSlash(node: TSESTree.Node | undefined): boolean {
  return stringValue(node) === '/'
}

/**
 * Tests whether a node is the string `\`.
 *
 * @param node - The node to test, or undefined.
 * @returns True for a constant backslash.
 */
export function isBackslash(node: TSESTree.Node | undefined): boolean {
  return stringValue(node) === '\\'
}

/**
 * Tests whether a node is a regex matching either separator, like `/[\\/]/`.
 *
 * @param node - The node to test, or undefined.
 * @returns True for a separator character class, optionally followed by `+`.
 */
function isSeparatorClass(node: TSESTree.Node | undefined): boolean {
  const regex = regexOf(node)
  if (!regex) return false
  const source = regex.pattern.endsWith('+') ? regex.pattern.slice(0, -1) : regex.pattern
  return SEPARATOR_CLASSES.includes(source)
}

/**
 * Tests whether a node produces a forward slash: the literal `/` or `posix.sep`.
 *
 * @param node - The node to test, or undefined.
 * @param binding - The file being linted.
 * @returns True when the node always evaluates to `/`.
 */
function isForwardSlash(node: TSESTree.Node | undefined, binding: BindingContext): boolean {
  return isSlash(node) || separatorFlavour(node, binding) === 'portable'
}

/**
 * Classifies `x.split(a).join(b)` conversions.
 *
 * @param call - A call whose method is `join`.
 * @param binding - The file being linted.
 * @returns The conversion shape, or null when the call is not a conversion.
 */
function joinShape(call: TSESTree.CallExpression, binding: BindingContext): ConversionShape | null {
  const split = unwrap(receiverOf(call))
  if (split.type !== AST_NODE_TYPES.CallExpression || methodName(split) !== 'split') return null
  const [splitArg] = split.arguments
  const [joinArg] = call.arguments
  if (!isForwardSlash(joinArg, binding)) return null
  if (separatorFlavour(splitArg, binding) === 'native') return separatorFlavour(joinArg, binding) === 'portable' ? 'canonical' : 'legacy'
  if (isBackslash(splitArg)) return 'legacy'
  return isSeparatorClass(splitArg) ? 'normalizing' : null
}

/**
 * Classifies `x.replace(a, '/')` and `x.replaceAll(a, '/')` conversions.
 *
 * @param call - The `replace` or `replaceAll` call.
 * @param binding - The file being linted.
 * @returns The conversion shape, or null when the call is not a conversion.
 */
function replaceShape(call: TSESTree.CallExpression, binding: BindingContext): ConversionShape | null {
  const [pattern, replacement] = call.arguments
  if (!isForwardSlash(replacement, binding)) return null
  const regex = regexOf(pattern)
  if (regex?.pattern === '\\\\' && regex.flags.includes('g')) return 'legacy'
  if (methodName(call) === 'replaceAll' && isBackslash(pattern)) return 'legacy'
  return isSeparatorClass(pattern) ? 'normalizing' : null
}

/**
 * Recognises a call that converts a path to forward slashes.
 *
 * @param node - The node to inspect.
 * @param binding - The file being linted.
 * @returns The conversion shape, or null when the node is not a conversion.
 */
export function conversionShape(node: TSESTree.Node, binding: BindingContext): ConversionShape | null {
  const call = unwrap(node)
  if (call.type !== AST_NODE_TYPES.CallExpression) return null
  const method = methodName(call)
  if (method === 'join') return joinShape(call, binding)
  return method === 'replace' || method === 'replaceAll' ? replaceShape(call, binding) : null
}

/**
 * Tests whether a `split` call is the first half of a `split(...).join(...)` conversion.
 *
 * @param split - The `split` call.
 * @param binding - The file being linted.
 * @returns True when the call's result is joined back into a converted path.
 */
export function isConversionSplit(split: TSESTree.CallExpression, binding: BindingContext): boolean {
  const member = split.parent
  if (member?.type !== AST_NODE_TYPES.MemberExpression || member.object !== split) return false
  return member.parent?.type === AST_NODE_TYPES.CallExpression && conversionShape(member.parent, binding) !== null
}
