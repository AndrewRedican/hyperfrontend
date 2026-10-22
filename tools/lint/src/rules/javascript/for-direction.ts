/**
 * A `for` loop whose update moves the counter away from the bound its test compares it with
 * never ends by that test. The step of an `i += n` update is read from the literal, or from a
 * variable that holds one constant value.
 *
 * @module rules/javascript/for-direction
 */

import type { Node, SourceToken } from '../../code/model.ts'
import type { ScopeAnalysis } from '../../scope/analysis.ts'
import type { Definition, Variable } from '../../scope/model.ts'
import { tokenBefore } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'
import { findVariable, scopeAnalysisOf, scopeOf } from '../../scope/analysis.ts'

/** A value known without running the code. */
interface StaticValue {
  /** The value. */
  readonly value: unknown
}

/** The globals whose value is known. */
const GLOBAL_VALUES: Readonly<Record<string, StaticValue>> = {
  NaN: { value: NaN },
  Infinity: { value: Infinity },
  undefined: { value: undefined },
}

/** The kinds of node that wrap an expression without changing its value. */
const WRAPPERS = ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'TSInstantiationExpression']

export default defineRule<undefined, Node>({
  id: 'for-direction',
  language: 'code',
  fixable: false,
  create(context) {
    const report = (node: Node): void => {
      // how: the report runs from the `for` to the closing parenthesis of its head, as the token before the body.
      const close = tokenBefore(context.tree, (node.body as Node).start)
      context.report({
        start: node.start,
        end: (close as SourceToken).end,
        message: 'The update clause in this loop moves the variable in the wrong direction.',
      })
    }
    return {
      ForStatement(node) {
        const test = node.test as Node | null
        const update = node.update as Node | null
        if (test === null || update === null || test.kind !== 'BinaryExpression') return
        for (const side of ['left', 'right'] as const) {
          const counter = test[side] as Node
          if (counter.kind !== 'Identifier') continue
          const wrong = wrongDirection(test.operator as string, side)
          if (wrong === 0) return
          if (updateDirection(scopeAnalysisOf(context), update, counter.name as string) === wrong) report(node)
        }
      },
    }
  },
})

/**
 * The direction that defeats a test: downward under `<` and `<=`, upward under `>` and `>=`,
 * reversed when the counter stands on the right.
 *
 * @param operator - The test's operator
 * @param side - Which side of the test the counter stands on
 * @returns -1 or 1, or 0 for a test that is no bound
 */
function wrongDirection(operator: string, side: 'left' | 'right'): number {
  if (operator === '<' || operator === '<=') return side === 'left' ? -1 : 1
  if (operator === '>' || operator === '>=') return side === 'left' ? 1 : -1
  return 0
}

/**
 * The direction an update moves a counter: 1 upward, -1 downward, 0 when it does not move it
 * or when the step is unknown, zero or not a number.
 *
 * @param analysis - The program's scope analysis
 * @param update - The loop's update expression
 * @param counter - The counter's name
 * @returns 1, -1 or 0
 */
function updateDirection(analysis: ScopeAnalysis, update: Node, counter: string): number {
  if (update.kind === 'UpdateExpression') {
    const argument = update.argument as Node
    if (argument.kind !== 'Identifier' || argument.name !== counter) return 0
    return update.operator === '++' ? 1 : -1
  }
  if (update.kind !== 'AssignmentExpression' || (update.left as Node).name !== counter) return 0
  const sign = update.operator === '+=' ? 1 : update.operator === '-=' ? -1 : 0
  if (sign === 0) return 0
  const step = staticValueOf(analysis, update.right as Node)
  if (step === null) return 0
  const kind = typeof step.value
  if (kind !== 'number' && kind !== 'bigint' && kind !== 'boolean') return 0
  const amount = Number(step.value)
  return amount > 0 ? sign : amount < 0 ? -sign : 0
}

/**
 * The value of an expression when it is known without running the code: a literal, an
 * arithmetic expression of such values, a global whose value is fixed, or a variable that is
 * assigned once with such a value.
 *
 * @param analysis - The program's scope analysis
 * @param node - The expression evaluated
 * @returns The value, or null when it is not known
 */
function staticValueOf(analysis: ScopeAnalysis, node: Node): StaticValue | null {
  switch (node.kind) {
    case 'Literal':
      return { value: node.value }
    case 'UnaryExpression': {
      const argument = staticValueOf(analysis, node.argument as Node)
      return argument === null ? null : unaryValue(node.operator as string, argument.value)
    }
    case 'BinaryExpression': {
      const left = staticValueOf(analysis, node.left as Node)
      const right = left === null ? null : staticValueOf(analysis, node.right as Node)
      return left === null || right === null ? null : binaryValue(node.operator as string, left.value, right.value)
    }
    case 'Identifier':
      return identifierValue(analysis, node)
    default:
      return WRAPPERS.includes(node.kind) ? staticValueOf(analysis, node.expression as Node) : null
  }
}

/**
 * The value of a unary operator applied to a known value: a negation, or an arithmetic operator
 * applied to a number, a boolean or a bigint.
 *
 * @param operator - The operator applied
 * @param value - The operand's value
 * @returns The result, or null when the operator is not evaluated on that value
 */
function unaryValue(operator: string, value: unknown): StaticValue | null {
  if (operator === '!') return { value: !value }
  if (typeof value === 'bigint') return operator === '-' ? { value: -value } : operator === '~' ? { value: ~value } : null
  if (typeof value !== 'number' && typeof value !== 'boolean') return null
  const amount = Number(value)
  if (operator === '-') return { value: -amount }
  if (operator === '+') return { value: amount }
  return operator === '~' ? { value: ~amount } : null
}

/**
 * The value of an arithmetic operator applied to two known numbers, or two known bigints.
 *
 * @param operator - The arithmetic operator applied
 * @param left - The left operand's value
 * @param right - The right operand's value
 * @returns The result, or null when the operands are not both numbers or both bigints
 */
function binaryValue(operator: string, left: unknown, right: unknown): StaticValue | null {
  if (typeof left !== typeof right || (typeof left !== 'number' && typeof left !== 'bigint')) return null
  const a = left as number
  const b = right as number
  switch (operator) {
    case '+':
      return { value: a + b }
    case '-':
      return { value: a - b }
    case '*':
      return { value: a * b }
    case '/':
      return { value: a / b }
    case '%':
      return { value: a % b }
    case '**':
      return { value: a ** b }
    default:
      return null
  }
}

/**
 * The value of a name: a global whose value is fixed, or a variable declared once with an
 * initialiser and never written again.
 *
 * @param analysis - The program's scope analysis
 * @param identifier - The identifier evaluated
 * @returns The value, or null when it is not known
 */
function identifierValue(analysis: ScopeAnalysis, identifier: Node): StaticValue | null {
  const name = identifier.name as string
  const variable = findVariable(scopeOf(analysis, identifier), name)
  if (variable === null) return null
  if (variable.defs.length === 0) return GLOBAL_VALUES[name] ?? null
  const def = variable.defs[0] as Definition
  if (variable.defs.length !== 1 || def.kind !== 'Variable' || (def.name.parent as Node).kind !== 'VariableDeclarator') return null
  if ((def.parent as Node).variableKind !== 'const' && !isEffectivelyConst(variable)) return null
  const init = def.node.init as Node | null
  return init === null ? null : staticValueOf(analysis, init)
}

/**
 * Whether a variable is written by its declaration alone and read everywhere else.
 *
 * @param variable - The variable tested
 * @returns Whether its value never changes after its initialisation
 */
function isEffectivelyConst(variable: Variable): boolean {
  let inits = 0
  let reads = 0
  for (const ref of variable.references) {
    if (ref.init) inits += 1
    else if (!ref.isWrite()) reads += 1
  }
  return inits === 1 && inits + reads === variable.references.length
}
