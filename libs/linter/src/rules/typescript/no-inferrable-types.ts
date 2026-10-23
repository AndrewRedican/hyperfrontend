/**
 * A type annotation on a variable, parameter default or property that is initialised with a
 * literal of that very type says nothing the initialiser does not; it is removed, together
 * with the `?` of an optional parameter or the `!` of a definite property that would be left
 * dangling.
 *
 * @module rules/typescript/no-inferrable-types
 */

import type { Node, SourceToken } from '../../code/model'
import type { RuleContext } from '../../engine/rule'
import { tokenBefore } from '../../code/source'
import { defineRule } from '../../engine/rule'

/** The type name each keyword annotation prints as. */
const KEYWORDS: Readonly<Record<string, string>> = {
  TSBigIntKeyword: 'bigint',
  TSBooleanKeyword: 'boolean',
  TSNullKeyword: 'null',
  TSNumberKeyword: 'number',
  TSStringKeyword: 'string',
  TSSymbolKeyword: 'symbol',
  TSUndefinedKeyword: 'undefined',
}

export default defineRule<undefined, Node>({
  id: 'typescript/no-inferrable-types',
  language: 'code',
  fixable: true,
  create(context) {
    const checkParameters = (node: Node): void => {
      for (const param of node.params as readonly Node[]) {
        const pattern = param.kind === 'TSParameterProperty' ? (param.parameter as Node) : param
        if (pattern.kind !== 'AssignmentPattern') continue
        const left = pattern.left as Node
        check(context, pattern, left.typeAnnotation, pattern.right as Node, left.optional === true)
      }
    }
    const checkProperty = (node: Node): void => {
      if (node.readonly === true || node.optional === true) return
      check(context, node, node.typeAnnotation, node.value as Node | null, node.definite === true)
    }
    return {
      VariableDeclarator(node) {
        check(context, node, (node.id as Node).typeAnnotation, node.init as Node | null, false)
      },
      FunctionDeclaration: checkParameters,
      FunctionExpression: checkParameters,
      ArrowFunctionExpression: checkParameters,
      PropertyDefinition: checkProperty,
      AccessorProperty: checkProperty,
    }
  },
})

/**
 * Reports an annotation its initialiser makes needless, with a fix removing it.
 *
 * @param context - The rule context
 * @param node - The declarator, assignment pattern or property reported
 * @param annotation - The type annotation node, or undefined when the declaration carries none
 * @param init - The initialiser, or null when there is none
 * @param marked - Whether a `?` or `!` sits before the annotation and goes with it
 */
function check(context: RuleContext<undefined, Node>, node: Node, annotation: Node | undefined, init: Node | null, marked: boolean): void {
  if (annotation === undefined || init === null) return
  const type = inferrableType(annotation.typeAnnotation as Node, init)
  if (type === null) return
  let fix = { start: annotation.start, end: annotation.end, text: '' }
  if (marked) {
    // how: the `?` or `!` goes with the annotation; the space between them, if any, stays.
    const mark = tokenBefore(context.tree, annotation.start) as SourceToken
    fix = { start: mark.start, end: annotation.end, text: context.file.text.slice(mark.end, annotation.start) }
  }
  context.report({
    start: node.start,
    end: node.end,
    message: `Type ${type} trivially inferred from a ${type} literal, remove type annotation.`,
    fix,
  })
}

/**
 * The name of an annotated type its initialiser already states, if it does.
 *
 * @param type - The annotated type
 * @param init - The initialiser
 * @returns The type name, or null when the annotation is not inferrable from the initialiser
 */
function inferrableType(type: Node, init: Node): string | null {
  const name = KEYWORDS[type.kind] ?? (type.kind === 'TSTypeReference' && isNamed(type.typeName as Node, 'RegExp') ? 'RegExp' : null)
  if (name === null) return null
  return isInferrable(name, init) ? name : null
}

/**
 * Whether an initialiser is a literal, construction or conversion of a type.
 *
 * @param name - The type name
 * @param init - The initialiser
 * @returns Whether the initialiser's type is plainly that type
 */
function isInferrable(name: string, init: Node): boolean {
  switch (name) {
    case 'bigint': {
      const inner = unwrapUnary(init, ['-'])
      return isCallOf(inner, 'BigInt') || (inner.kind === 'Literal' && inner.bigint !== undefined)
    }
    case 'boolean':
      return (init.kind === 'UnaryExpression' && init.operator === '!') || isCallOf(init, 'Boolean') || isLiteralOf(init, 'boolean')
    case 'number': {
      const inner = unwrapUnary(init, ['+', '-'])
      return isNamed(inner, 'Infinity') || isNamed(inner, 'NaN') || isCallOf(inner, 'Number') || isLiteralOf(inner, 'number')
    }
    case 'null':
      return init.kind === 'Literal' && init.value === null && init.regex === undefined
    case 'string':
      return isCallOf(init, 'String') || isLiteralOf(init, 'string') || init.kind === 'TemplateLiteral'
    case 'symbol':
      return isCallOf(init, 'Symbol')
    case 'undefined':
      return (init.kind === 'UnaryExpression' && init.operator === 'void') || isNamed(init, 'undefined')
    default:
      return (
        (init.kind === 'Literal' && init.regex !== undefined) ||
        (init.kind === 'NewExpression' && isNamed(init.callee as Node, 'RegExp')) ||
        isCallOf(init, 'RegExp')
      )
  }
}

/**
 * The operand of a unary expression with one of some operators, or the expression itself.
 *
 * @param init - The expression
 * @param operators - The operators looked through
 * @returns The operand, or the expression when it is not such a unary expression
 */
function unwrapUnary(init: Node, operators: readonly string[]): Node {
  return init.kind === 'UnaryExpression' && operators.includes(init.operator as string) ? (init.argument as Node) : init
}

/**
 * Whether an expression is an identifier of a name.
 *
 * @param node - The expression
 * @param name - The identifier text looked for
 * @returns Whether it is that identifier
 */
function isNamed(node: Node, name: string): boolean {
  return node.kind === 'Identifier' && node.name === name
}

/**
 * Whether an expression calls a global function by name, optionally or not.
 *
 * @param init - The expression
 * @param name - The function's name
 * @returns Whether it is such a call
 */
function isCallOf(init: Node, name: string): boolean {
  const call = init.kind === 'ChainExpression' ? (init.expression as Node) : init
  return call.kind === 'CallExpression' && isNamed(call.callee as Node, name)
}

/**
 * Whether an expression is a literal whose value has a primitive type.
 *
 * @param init - The expression
 * @param type - The name `typeof` gives the value
 * @returns Whether it is such a literal
 */
function isLiteralOf(init: Node, type: string): boolean {
  return init.kind === 'Literal' && typeof init.value === type
}
