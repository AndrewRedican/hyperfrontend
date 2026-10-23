/**
 * A comparison whose outcome is fixed by one operand alone, a logical expression whose left
 * side decides it, or an equality against an object created on the spot: the operation does
 * not depend on the other value and is a mistake.
 *
 * @module rules/javascript/no-constant-binary-expression
 */

import type { Node } from '../../code/model'
import type { ScopeAnalysis } from '../../scope/analysis'
import { objectHasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf } from '../../scope/analysis'
import { LANGUAGE_GLOBALS } from '../../scope/globals'
import { isConstant, isConstantBooleanCall, isGlobalReference, lastOfSequence } from './shared/constant'

/** The binary operators whose result is a number or a string. */
const NUMERIC_OR_STRING = createSet<string>(['+', '-', '*', '/', '%', '|', '^', '&', '**', '<<', '>>', '>>>'])

/** The assignment operators that assign only sometimes. */
const LOGICAL_ASSIGNMENTS = createSet<string>(['||=', '&&=', '??='])

/** The kinds of expression that are never null or undefined. */
const NEVER_NULLISH = createSet<string>([
  'ObjectExpression',
  'ArrayExpression',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassExpression',
  'NewExpression',
  'Literal',
  'TemplateLiteral',
  'UpdateExpression',
  'BinaryExpression',
])

/** The kinds of expression whose strict comparison with a boolean is fixed. */
const STRICTLY_FIXED = createSet<string>([
  'ObjectExpression',
  'ArrayExpression',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassExpression',
  'NewExpression',
  'TemplateLiteral',
  'Literal',
  'UpdateExpression',
])

/** The kinds of expression whose loose comparison with a boolean is fixed. */
const LOOSELY_FIXED = createSet<string>(['ObjectExpression', 'ClassExpression', 'ArrowFunctionExpression', 'FunctionExpression', 'Literal'])

/** The kinds of expression that create a new object every time. */
const ALWAYS_NEW = createSet<string>([
  'ObjectExpression',
  'ArrayExpression',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassExpression',
])

/** The message about an operand whose comparison is fixed. */
const ALWAYS_NEW_MESSAGE = 'Unexpected comparison to newly constructed object. These two values can never be equal.'

/** The message about two operands created on the spot. */
const BOTH_ALWAYS_NEW_MESSAGE = 'Unexpected comparison of two newly constructed objects. These two values can never be equal.'

export default defineRule<undefined, Node>({
  id: 'no-constant-binary-expression',
  language: 'code',
  fixable: false,
  create(context) {
    const report = (node: Node, message: string): void => {
      context.report({ start: node.start, end: node.end, message })
    }
    return {
      LogicalExpression(node) {
        const analysis = scopeAnalysisOf(context)
        const operator = node.operator as string
        const left = node.left as Node
        if (operator === '??') {
          if (hasConstantNullishness(analysis, left, false))
            report(left, 'Unexpected constant nullishness on the left-hand side of a `??` expression.')
        } else if (isConstant(analysis, left, true)) {
          report(left, `Unexpected constant truthiness on the left-hand side of a \`${operator}\` expression.`)
        }
      },
      BinaryExpression(node) {
        const operator = node.operator as string
        const strict = operator === '===' || operator === '!=='
        if (!strict && operator !== '==' && operator !== '!=') return
        const analysis = scopeAnalysisOf(context)
        const left = node.left as Node
        const right = node.right as Node
        const fixed = (side: string): string =>
          `Unexpected constant binary expression. Compares constantly with the ${side}-hand side of the \`${operator}\`.`
        if (comparesConstantly(analysis, left, right, strict)) report(right, fixed('left'))
        else if (comparesConstantly(analysis, right, left, strict)) report(left, fixed('right'))
        else if (strict) {
          if (isAlwaysNew(analysis, left)) report(left, ALWAYS_NEW_MESSAGE)
          else if (isAlwaysNew(analysis, right)) report(right, ALWAYS_NEW_MESSAGE)
        } else if (isAlwaysNew(analysis, left) && isAlwaysNew(analysis, right)) report(left, BOTH_ALWAYS_NEW_MESSAGE)
      },
    }
  },
})

/**
 * Whether an operand's comparison with a null-like or boolean operand has a fixed outcome.
 *
 * @param analysis - The program's scope analysis
 * @param against - The operand compared with
 * @param operand - The operand tested
 * @param strict - Whether the comparison is strict
 * @returns Whether the comparison does not depend on the operand's value
 */
function comparesConstantly(analysis: ScopeAnalysis, against: Node, operand: Node, strict: boolean): boolean {
  if (isNullOrUndefined(analysis, against)) return hasConstantNullishness(analysis, operand, false)
  if (!isStaticBoolean(analysis, against)) return false
  return strict ? hasConstantStrictBooleanComparison(analysis, operand) : hasConstantLooseBooleanComparison(analysis, operand)
}

/**
 * Whether an expression is `null`, the language's `undefined` or a `void` expression.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression tested
 * @returns Whether it is null-like
 */
function isNullOrUndefined(analysis: ScopeAnalysis, node: Node): boolean {
  if (node.kind === 'Literal') return node.value === null && node.regex === undefined
  if (node.kind === 'Identifier') return node.name === 'undefined' && isGlobalReference(analysis, node)
  return node.kind === 'UnaryExpression' && node.operator === 'void'
}

/**
 * Whether an expression is always nullish or never nullish.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression tested
 * @param nonNullish - Whether only an expression that is never nullish counts
 * @returns Whether the nullishness of the expression is fixed
 */
function hasConstantNullishness(analysis: ScopeAnalysis, node: Node, nonNullish: boolean): boolean {
  if (nonNullish && isNullOrUndefined(analysis, node)) return false
  if (NEVER_NULLISH.has(node.kind)) return true
  switch (node.kind) {
    case 'CallExpression': {
      const callee = node.callee as Node
      const name = callee.name as string
      return (
        callee.kind === 'Identifier' &&
        (name === 'Boolean' || name === 'String' || name === 'Number') &&
        isGlobalReference(analysis, callee)
      )
    }
    case 'LogicalExpression':
      return node.operator === '??' && hasConstantNullishness(analysis, node.right as Node, true)
    case 'AssignmentExpression':
      if (node.operator === '=') return hasConstantNullishness(analysis, node.right as Node, nonNullish)
      return !LOGICAL_ASSIGNMENTS.has(node.operator as string)
    case 'UnaryExpression':
      return true
    case 'SequenceExpression':
      return hasConstantNullishness(analysis, lastOfSequence(node), nonNullish)
    case 'Identifier':
      return node.name === 'undefined' && isGlobalReference(analysis, node)
    default:
      return false
  }
}

/**
 * Whether an expression is a boolean that never changes: a literal, a negation of a constant
 * or a `Boolean` call on a constant.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression tested
 * @returns Whether it is a fixed boolean
 */
function isStaticBoolean(analysis: ScopeAnalysis, node: Node): boolean {
  switch (node.kind) {
    case 'Literal':
      return typeof node.value === 'boolean'
    case 'CallExpression':
      return isConstantBooleanCall(analysis, node)
    case 'UnaryExpression':
      return node.operator === '!' && isConstant(analysis, node.argument as Node, true)
    default:
      return false
  }
}

/**
 * Whether an expression compared loosely with a boolean gives a fixed outcome; the comparison
 * coerces both sides to numbers, so what matters is whether the number is fixed.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression tested
 * @returns Whether the loose comparison is fixed
 */
function hasConstantLooseBooleanComparison(analysis: ScopeAnalysis, node: Node): boolean {
  if (LOOSELY_FIXED.has(node.kind)) return true
  switch (node.kind) {
    case 'ArrayExpression': {
      const elements = node.elements as readonly (Node | null)[]
      // why: an empty array coerces to 0 and one of several elements to NaN; a single element coerces to its own value.
      return elements.length === 0 || elements.filter((element) => element !== null && element.kind !== 'SpreadElement').length > 1
    }
    case 'UnaryExpression':
      if (node.operator === 'void' || node.operator === 'typeof') return true
      return node.operator === '!' && isConstant(analysis, node.argument as Node, true)
    case 'CallExpression':
      return isConstantBooleanCall(analysis, node)
    case 'Identifier':
      return node.name === 'undefined' && isGlobalReference(analysis, node)
    case 'TemplateLiteral':
      return (node.expressions as readonly Node[]).length === 0
    case 'AssignmentExpression':
      return node.operator === '=' && hasConstantLooseBooleanComparison(analysis, node.right as Node)
    case 'SequenceExpression':
      return hasConstantLooseBooleanComparison(analysis, lastOfSequence(node))
    default:
      return false
  }
}

/**
 * Whether an expression compared strictly with a boolean gives a fixed outcome: anything that
 * is never a boolean, or a boolean that never changes.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression tested
 * @returns Whether the strict comparison is fixed
 */
function hasConstantStrictBooleanComparison(analysis: ScopeAnalysis, node: Node): boolean {
  if (STRICTLY_FIXED.has(node.kind)) return true
  switch (node.kind) {
    case 'BinaryExpression':
      return NUMERIC_OR_STRING.has(node.operator as string)
    case 'UnaryExpression':
      if (node.operator === 'delete') return false
      return node.operator !== '!' || isConstant(analysis, node.argument as Node, true)
    case 'SequenceExpression':
      return hasConstantStrictBooleanComparison(analysis, lastOfSequence(node))
    case 'Identifier':
      return node.name === 'undefined' && isGlobalReference(analysis, node)
    case 'AssignmentExpression':
      if (node.operator === '=') return hasConstantStrictBooleanComparison(analysis, node.right as Node)
      return !LOGICAL_ASSIGNMENTS.has(node.operator as string)
    case 'CallExpression': {
      const callee = node.callee as Node
      if (callee.kind !== 'Identifier') return false
      if (callee.name === 'String' || callee.name === 'Number') return isGlobalReference(analysis, callee)
      return isConstantBooleanCall(analysis, node)
    }
    default:
      return false
  }
}

/**
 * Whether an expression creates a new object every time it runs, which no other value can
 * equal: a literal object, array, function, class or regular expression, or a construction of
 * one of the language's own constructors.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression tested
 * @returns Whether its value is always a fresh object
 */
function isAlwaysNew(analysis: ScopeAnalysis, node: Node): boolean {
  if (ALWAYS_NEW.has(node.kind)) return true
  switch (node.kind) {
    case 'NewExpression': {
      const callee = node.callee as Node
      return callee.kind === 'Identifier' && objectHasOwn(LANGUAGE_GLOBALS, callee.name as string) && isGlobalReference(analysis, callee)
    }
    case 'Literal':
      return node.regex !== undefined
    case 'SequenceExpression':
      return isAlwaysNew(analysis, lastOfSequence(node))
    case 'AssignmentExpression':
      return node.operator === '=' && isAlwaysNew(analysis, node.right as Node)
    case 'ConditionalExpression':
      return isAlwaysNew(analysis, node.consequent as Node) && isAlwaysNew(analysis, node.alternate as Node)
    default:
      return false
  }
}
