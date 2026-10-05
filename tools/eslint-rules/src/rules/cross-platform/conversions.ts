import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import type { CheckContext } from './types'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { methodName, receiverOf, stringValue, unwrap } from './ast'
import { referenceOf, variableOf } from './bindings'
import { planImports, planSeparators } from './imports'
import { conversionShape, separatorFlavour } from './shapes'

/**
 * Collection methods whose arguments end up as keys or stored values.
 */
const COLLECTION_METHODS: readonly string[] = ['push', 'unshift', 'add', 'set', 'has', 'get']

/**
 * How many variable hops the escape analysis follows.
 */
const MAX_HOPS = 8

/**
 * Builds the edit that rewrites a legacy conversion into `x.split(sep).join(posix.sep)`.
 *
 * @param check - The check context.
 * @param call - The legacy conversion call.
 * @returns The fix, or null when the separators cannot be referenced.
 */
function canonicalConversionFix(check: CheckContext, call: TSESTree.CallExpression): TSESLint.ReportFixFunction | null {
  if (methodName(call) !== 'join') {
    const plan = planSeparators(check.sourceCode, call)
    const property = (call.callee as TSESTree.MemberExpression).property
    return (
      plan &&
      ((fixer) => [
        ...plan.fixes(fixer),
        fixer.replaceTextRange([property.range[0], call.range[1]], `split(${plan.texts[0]}).join(${plan.texts[1]})`),
      ])
    )
  }
  const split = unwrap(receiverOf(call)) as TSESTree.CallExpression
  const splitArg = split.arguments[0]
  const joinArg = call.arguments[0]
  const needsSep = separatorFlavour(splitArg, check.binding) !== 'native'
  const needsPosix = separatorFlavour(joinArg, check.binding) !== 'portable'
  const plan = planImports(check.sourceCode, call, [
    ...(needsSep ? [['path', 'sep'] as const] : []),
    ...(needsPosix ? [['path', 'posix'] as const] : []),
  ])
  if (!plan) return null
  return (fixer) => [
    ...plan.fixes(fixer),
    ...(needsSep ? [fixer.replaceText(splitArg, plan.texts[0])] : []),
    ...(needsPosix ? [fixer.replaceText(joinArg, `${plan.texts[plan.texts.length - 1]}.sep`)] : []),
  ]
}

/**
 * Reports native-to-POSIX conversions spelled any way but `x.split(sep).join(posix.sep)`.
 * The legacy spellings also rewrite backslashes, which are legal in POSIX file names.
 *
 * @param check - The check context.
 * @param call - A call expression.
 */
export function checkPosixConversion(check: CheckContext, call: TSESTree.CallExpression): void {
  if (!check.nodeCapable || conversionShape(call, check.binding) !== 'legacy') return
  check.context.report({ node: call, messageId: 'posixConversion', fix: check.nodeFile ? canonicalConversionFix(check, call) : null })
}

/**
 * Tests whether a node passes its value through unchanged to its parent.
 *
 * @param parent - The parent node.
 * @param child - The child node.
 * @returns True for type wrappers, fallbacks, and conditional branches.
 */
function passesThrough(parent: TSESTree.Node, child: TSESTree.Node): boolean {
  switch (parent.type) {
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
    case AST_NODE_TYPES.TSTypeAssertion:
    case AST_NODE_TYPES.ChainExpression:
      return true
    case AST_NODE_TYPES.LogicalExpression:
      return parent.operator !== '&&'
    case AST_NODE_TYPES.ConditionalExpression:
      return parent.test !== child
    default:
      return false
  }
}

/**
 * Tests whether the other side of a comparison could hold a separator.
 *
 * @param comparison - The `===` or `!==` comparison.
 * @param side - The side holding the relative path.
 * @returns False when the other side is a constant string without `/`.
 */
function comparesWithPath(comparison: TSESTree.BinaryExpression, side: TSESTree.Node): boolean {
  const value = stringValue(comparison.left === side ? comparison.right : comparison.left)
  return value === null || value.includes('/')
}

/**
 * Tests whether a value leaves the function as data whose separators matter: returned,
 * stored in an object, array, or collection, compared, or prefixed like a specifier.
 *
 * @param node - The expression holding a `relative()` result.
 * @param check - The check context.
 * @param hops - Variable hops followed so far.
 * @returns True when the value escapes.
 */
function escapes(node: TSESTree.Node, check: CheckContext, hops: number): boolean {
  let child = node
  let parent = node.parent
  while (parent && passesThrough(parent, child)) {
    child = parent
    parent = parent.parent
  }
  switch (parent?.type) {
    case AST_NODE_TYPES.ReturnStatement:
    case AST_NODE_TYPES.ArrayExpression:
      return true
    case AST_NODE_TYPES.ArrowFunctionExpression:
      return parent.body === child
    case AST_NODE_TYPES.Property:
      return parent.value === child && parent.parent.type === AST_NODE_TYPES.ObjectExpression
    case AST_NODE_TYPES.AssignmentExpression:
      return parent.right === child && parent.left.type === AST_NODE_TYPES.MemberExpression
    case AST_NODE_TYPES.CallExpression: {
      const method = methodName(parent)
      return method !== null && COLLECTION_METHODS.includes(method) && parent.arguments.includes(child as TSESTree.Expression)
    }
    case AST_NODE_TYPES.BinaryExpression:
      return (parent.operator === '===' || parent.operator === '!==') && comparesWithPath(parent, child)
    case AST_NODE_TYPES.TemplateLiteral: {
      const head = parent.quasis[0].value.cooked
      return ['./', '../', '/'].some((prefix) => head.startsWith(prefix))
    }
    case AST_NODE_TYPES.VariableDeclarator: {
      if (parent.init !== child || parent.id.type !== AST_NODE_TYPES.Identifier || hops >= MAX_HOPS) return false
      const variable = variableOf(parent.id, check.sourceCode)
      return variable?.references.some((reference) => reference.isRead() && escapes(reference.identifier, check, hops + 1)) ?? false
    }
    default:
      return false
  }
}

/**
 * Reports a native `relative()` result that leaves the function as data, where Windows
 * backslashes leak into keys, Nx roots, and output.
 *
 * @param check - The check context.
 * @param call - A call expression.
 */
export function checkRelativeEscapes(check: CheckContext, call: TSESTree.CallExpression): void {
  const reference = referenceOf(call.callee, check.binding)
  if (reference?.module !== 'path' || reference.name !== 'relative' || !escapes(call, check, 0)) return
  const plan = planSeparators(check.sourceCode, call)
  check.context.report({
    node: call,
    messageId: 'relativeEscapes',
    fix: plan && ((fixer) => [...plan.fixes(fixer), fixer.insertTextAfter(call, `.split(${plan.texts[0]}).join(${plan.texts[1]})`)]),
  })
}
