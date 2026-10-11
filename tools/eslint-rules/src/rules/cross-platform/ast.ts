import type { TSESTree } from '@typescript-eslint/utils'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'

/**
 * Strips the wrappers that change an expression's type but not its value: type assertions,
 * non-null assertions, `satisfies`, and optional-chain envelopes.
 *
 * @param node - Any expression node.
 * @returns The innermost node that produces the value.
 */
export function unwrap(node: TSESTree.Node): TSESTree.Node {
  let current = node
  while (
    current.type === AST_NODE_TYPES.TSAsExpression ||
    current.type === AST_NODE_TYPES.TSNonNullExpression ||
    current.type === AST_NODE_TYPES.TSSatisfiesExpression ||
    current.type === AST_NODE_TYPES.TSTypeAssertion ||
    current.type === AST_NODE_TYPES.ChainExpression
  ) {
    current = current.expression
  }
  return current
}

/**
 * Reads the string a node always evaluates to: a string literal, or a template without
 * interpolations.
 *
 * @param node - The node to read, or undefined.
 * @returns The string value, or null when the node is not a constant string.
 */
export function stringValue(node: TSESTree.Node | undefined): string | null {
  if (!node) return null
  const expr = unwrap(node)
  if (expr.type === AST_NODE_TYPES.Literal) return typeof expr.value === 'string' ? expr.value : null
  if (expr.type === AST_NODE_TYPES.TemplateLiteral && expr.expressions.length === 0) return expr.quasis[0].value.cooked
  return null
}

/**
 * Reads the name of a non-computed member property.
 *
 * @param member - The member expression.
 * @returns The property name, or null for computed or private access.
 */
export function propertyName(member: TSESTree.MemberExpression): string | null {
  return !member.computed && member.property.type === AST_NODE_TYPES.Identifier ? member.property.name : null
}

/**
 * Returns the method a call invokes on its receiver, as in `receiver.method(...)`.
 *
 * @param node - The node to inspect.
 * @returns The method name, or null when the node is not a non-computed method call.
 */
export function methodName(node: TSESTree.Node): string | null {
  const call = unwrap(node)
  if (call.type !== AST_NODE_TYPES.CallExpression || call.callee.type !== AST_NODE_TYPES.MemberExpression) return null
  return propertyName(call.callee)
}

/**
 * Returns the receiver of a method call, as in `receiver.method(...)`.
 *
 * @param call - A call already known to be a method call.
 * @returns The receiver expression.
 */
export function receiverOf(call: TSESTree.CallExpression): TSESTree.Expression {
  return (call.callee as TSESTree.MemberExpression).object
}

/**
 * Reads the name a call is invoked through: the function identifier or the method name.
 *
 * @param call - The call expression.
 * @returns The callee name, or null when the callee has no static name.
 */
export function calleeName(call: TSESTree.CallExpression): string | null {
  if (call.callee.type === AST_NODE_TYPES.Identifier) return call.callee.name
  return methodName(call)
}

/**
 * Reads a regular expression literal's pattern and flags.
 *
 * @param node - The node to inspect, or undefined.
 * @returns The pattern and flags, or null when the node is not a regex literal.
 */
export function regexOf(node: TSESTree.Node | undefined): TSESTree.RegExpLiteral['regex'] | null {
  if (!node || node.type !== AST_NODE_TYPES.Literal || !('regex' in node)) return null
  return node.regex
}

/**
 * Tests whether a node is `import.meta.<name>`.
 *
 * @param node - The node to test.
 * @param name - The `import.meta` property to match.
 * @returns True when the node reads that property.
 */
export function isImportMeta(node: TSESTree.Node, name: string): boolean {
  return (
    node.type === AST_NODE_TYPES.MemberExpression &&
    node.object.type === AST_NODE_TYPES.MetaProperty &&
    node.object.meta.name === 'import' &&
    propertyName(node) === name
  )
}

/**
 * Tests whether a node is an operand of a larger `+` chain, so only the outermost
 * concatenation is analysed.
 *
 * @param node - The node to test.
 * @returns True when the parent is a `+` binary expression.
 */
export function isConcatOperand(node: TSESTree.Node): boolean {
  return node.parent?.type === AST_NODE_TYPES.BinaryExpression && node.parent.operator === '+'
}
