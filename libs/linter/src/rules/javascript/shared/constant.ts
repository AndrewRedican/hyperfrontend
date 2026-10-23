/**
 * What an expression can be known to hold without running the code: whether its truthiness, or
 * its value, never changes. The constant-condition rules share these checks, and the global
 * reference test they rest on, which is what tells the language's `undefined` and `Boolean`
 * from a name a script declares in their place.
 *
 * @module rules/javascript/shared/constant
 */

import type { Node, TemplateValue } from '../../../code/model'
import type { ScopeAnalysis } from '../../../scope/analysis'
import type { Reference } from '../../../scope/model'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'

/** The reference each identifier makes, by analysis, built on first request. */
const indexes = createWeakMap<ScopeAnalysis, WeakMap<Node, Reference>>()

/**
 * The reference an identifier makes, found through the analysis of its program.
 *
 * @param analysis - The program's scope analysis
 * @param identifier - The identifier looked up
 * @returns The reference, or null when the identifier makes none
 *
 * @example Follow a use of a name back to its variable
 * ```ts
 * // program: const limit = 10 / limit + 1 / function check() {}
 * referenceOf(analysis, limitInSum)?.resolved?.name // => 'limit'
 * referenceOf(analysis, checkDeclaration.id) // => null (a declaration, not a use)
 * ```
 */
export function referenceOf(analysis: ScopeAnalysis, identifier: Node): Reference | null {
  let index = indexes.get(analysis)
  if (index === undefined) {
    index = createWeakMap<Node, Reference>()
    for (const scope of analysis.scopes) for (const ref of scope.references) index.set(ref.identifier, ref)
    indexes.set(analysis, index)
  }
  return index.get(identifier) ?? null
}

/**
 * Whether an identifier refers to a global: a name the language or the configuration declares,
 * which no declaration of the program shadows, or a name nothing declares at all.
 *
 * @param analysis - The program's scope analysis
 * @param identifier - The identifier tested
 * @returns Whether the reference resolves to no declaration of the program
 *
 * @example Tell the language's undefined from a parameter named undefined
 * ```ts
 * // program: limit + undefined
 * //          function read(undefined) { return undefined }
 * isGlobalReference(analysis, undefinedInSum) // => true
 * isGlobalReference(analysis, undefinedInRead) // => false (the parameter)
 * ```
 */
export function isGlobalReference(analysis: ScopeAnalysis, identifier: Node): boolean {
  const ref = referenceOf(analysis, identifier)
  return ref !== null && (ref.resolved === null || ref.resolved.defs.length === 0)
}

/**
 * The expression a sequence yields: its last.
 *
 * @param sequence - The sequence expression
 * @returns Its last expression
 *
 * @example Find what a comma expression evaluates to
 * ```ts
 * // sequence: (load(), retries)
 * const last = lastOfSequence(sequence)
 * file.text.slice(last.start, last.end) // => 'retries'
 * ```
 */
export function lastOfSequence(sequence: Node): Node {
  const expressions = sequence.expressions as readonly Node[]
  return expressions[expressions.length - 1] as Node
}

/**
 * Whether a literal is truthy; a regular expression always is.
 *
 * @param literal - The literal tested
 * @returns Its truthiness
 *
 * @example Truthiness of literals, regular expressions included
 * ```ts
 * // literals: 0, '', 'no', /x/
 * literals.map(isTruthyLiteral) // => [false, false, true, true]
 * ```
 */
export function isTruthyLiteral(literal: Node): boolean {
  return literal.regex !== undefined || Boolean(literal.value)
}

/**
 * Whether an operand decides a logical expression on its own: `true` on the left of `||`,
 * `false` or `void` on the left of `&&`, or a nested expression of the same operator with such
 * an operand.
 *
 * @param node - The operand tested
 * @param operator - The logical operator, `||` or `&&`
 * @returns Whether the operand short-circuits the operator
 *
 * @example Operands that settle a logical expression on their own
 * ```ts
 * // left operands: true, false, void 0
 * isLogicalIdentity(trueLiteral, '||') // => true
 * isLogicalIdentity(falseLiteral, '&&') // => true
 * isLogicalIdentity(voidZero, '&&') // => true
 * isLogicalIdentity(trueLiteral, '??') // => false
 * ```
 */
export function isLogicalIdentity(node: Node, operator: string): boolean {
  switch (node.kind) {
    case 'Literal':
      return operator !== '??' && isTruthyLiteral(node) === (operator === '||')
    case 'UnaryExpression':
      return operator === '&&' && node.operator === 'void'
    case 'LogicalExpression':
      return (
        operator === node.operator && (isLogicalIdentity(node.left as Node, operator) || isLogicalIdentity(node.right as Node, operator))
      )
    case 'AssignmentExpression': {
      const assigned = node.operator as string
      return (
        (assigned === '||=' || assigned === '&&=') && operator === assigned.slice(0, -1) && isLogicalIdentity(node.right as Node, operator)
      )
    }
    default:
      return false
  }
}

/**
 * Whether a call is the language's `Boolean` applied to nothing or to a constant.
 *
 * @param analysis - The program's scope analysis
 * @param node - The call tested
 * @returns Whether the call yields a constant boolean
 *
 * @example Only the global Boolean counts
 * ```ts
 * // calls: Boolean(1), Boolean(flag)
 * isConstantBooleanCall(analysis, booleanOfOne) // => true
 * isConstantBooleanCall(analysis, booleanOfFlag) // => false
 * // after function Boolean(value) {}, Boolean(1) gives false
 * ```
 */
export function isConstantBooleanCall(analysis: ScopeAnalysis, node: Node): boolean {
  const callee = node.callee as Node
  if (callee.kind !== 'Identifier' || callee.name !== 'Boolean') return false
  const args = node.arguments as readonly Node[]
  return (args.length === 0 || isConstant(analysis, args[0] as Node, true)) && isGlobalReference(analysis, callee)
}

/**
 * Whether an expression's value, or in a boolean position its truthiness, never changes.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression tested, or null for a hole in an array
 * @param inBooleanPosition - Whether only the truthiness of the value matters
 * @returns Whether the expression is constant
 *
 * @example Whether only truthiness matters changes the answer
 * ```ts
 * // expression: flag || true
 * isConstant(analysis, expression, true) // => true (always truthy)
 * isConstant(analysis, expression, false) // => false (may be flag's value)
 * // expression: retries > 3
 * isConstant(analysis, expression, true) // => false
 * ```
 */
export function isConstant(analysis: ScopeAnalysis, node: Node | null, inBooleanPosition: boolean): boolean {
  if (node === null) return true
  switch (node.kind) {
    case 'Literal':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
    case 'ClassExpression':
    case 'ObjectExpression':
      return true
    case 'TemplateLiteral':
      return (
        (inBooleanPosition &&
          (node.quasis as readonly Node[]).some((quasi) => ((quasi.value as TemplateValue).cooked as string).length > 0)) ||
        (node.expressions as readonly Node[]).every((expression) => isConstant(analysis, expression, false))
      )
    case 'ArrayExpression':
      return inBooleanPosition || (node.elements as readonly (Node | null)[]).every((element) => isConstant(analysis, element, false))
    case 'UnaryExpression':
      if (node.operator === 'void' || (node.operator === 'typeof' && inBooleanPosition)) return true
      return isConstant(analysis, node.argument as Node, node.operator === '!')
    case 'BinaryExpression':
      return node.operator !== 'in' && isConstant(analysis, node.left as Node, false) && isConstant(analysis, node.right as Node, false)
    case 'LogicalExpression': {
      const operator = node.operator as string
      const left = isConstant(analysis, node.left as Node, inBooleanPosition)
      const right = isConstant(analysis, node.right as Node, inBooleanPosition)
      return (
        (left && right) ||
        (left && isLogicalIdentity(node.left as Node, operator)) ||
        (inBooleanPosition && right && isLogicalIdentity(node.right as Node, operator))
      )
    }
    case 'NewExpression':
      return inBooleanPosition
    case 'AssignmentExpression': {
      const operator = node.operator as string
      if (operator === '=') return isConstant(analysis, node.right as Node, inBooleanPosition)
      return (operator === '||=' || operator === '&&=') && inBooleanPosition && isLogicalIdentity(node.right as Node, operator.slice(0, -1))
    }
    case 'SequenceExpression':
      return isConstant(analysis, lastOfSequence(node), inBooleanPosition)
    case 'SpreadElement':
      return isConstant(analysis, node.argument as Node, inBooleanPosition)
    case 'CallExpression':
      return isConstantBooleanCall(analysis, node)
    case 'Identifier':
      return node.name === 'undefined' && isGlobalReference(analysis, node)
    default:
      return false
  }
}
