/**
 * A type assertion is written `value as Type`; the angle-bracket form `<Type>value` reads as
 * JSX and is rewritten. The rewrite keeps the meaning: the value is parenthesised when it
 * binds no tighter than `as`, and the whole assertion when what holds it binds at least as
 * tight, unless it already sits in parentheses of its own.
 *
 * @module rules/typescript/consistent-type-assertions
 */

import type { Node, SourceToken } from '../../code/model.ts'
import type { RuleContext } from '../../engine/rule.ts'
import { tokenAfter, tokenBefore, tokensBetween } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'

/** The precedence of an expression no operator table knows, lowest of all. */
const INVALID = -1
/** The precedence of a comma sequence. */
const COMMA = 0
/** The precedence of a spread. */
const SPREAD = 1
/** The precedence of `yield`, and of an arrow function, whose body runs as far as it can. */
const YIELD = 2
/** The precedence of an assignment. */
const ASSIGNMENT = 3
/** The precedence of a conditional, shared by `??`. */
const CONDITIONAL = 4
/** The precedence of `as` itself, with the comparison operators. */
const RELATIONAL = 11
/** The precedence of a prefix operator, `await` or an angle-bracket assertion. */
const UNARY = 16
/** The precedence of a call. */
const LEFT_HAND_SIDE = 18
/** The precedence of a member access, tagged template or `new` with arguments. */
const MEMBER = 19
/** The precedence of a literal, name, function, class or template. */
const PRIMARY = 20

/** The precedence of each binary and logical operator. */
const OPERATORS: Readonly<Record<string, number>> = {
  '??': CONDITIONAL,
  '||': 5,
  '&&': 6,
  '|': 7,
  '^': 8,
  '&': 9,
  '==': 10,
  '!=': 10,
  '===': 10,
  '!==': 10,
  '<': RELATIONAL,
  '>': RELATIONAL,
  '<=': RELATIONAL,
  '>=': RELATIONAL,
  instanceof: RELATIONAL,
  in: RELATIONAL,
  '<<': 12,
  '>>': 12,
  '>>>': 12,
  '+': 13,
  '-': 13,
  '*': 14,
  '/': 14,
  '%': 14,
  '**': 15,
}

/** The precedence of an asserted value by its kind; a `new` and an update share the precedence of their tighter form, which decides the same. */
const VALUES: Readonly<Record<string, number>> = {
  SequenceExpression: COMMA,
  YieldExpression: YIELD,
  ArrowFunctionExpression: YIELD,
  ConditionalExpression: CONDITIONAL,
  AssignmentExpression: ASSIGNMENT,
  TSTypeAssertion: UNARY,
  TSNonNullExpression: UNARY,
  UnaryExpression: UNARY,
  AwaitExpression: UNARY,
  UpdateExpression: UNARY,
  CallExpression: LEFT_HAND_SIDE,
  NewExpression: LEFT_HAND_SIDE,
  TaggedTemplateExpression: MEMBER,
  MemberExpression: MEMBER,
  MetaProperty: MEMBER,
  TSAsExpression: RELATIONAL,
  TSSatisfiesExpression: RELATIONAL,
  ThisExpression: PRIMARY,
  Super: PRIMARY,
  Identifier: PRIMARY,
  PrivateIdentifier: PRIMARY,
  Literal: PRIMARY,
  ArrayExpression: PRIMARY,
  ObjectExpression: PRIMARY,
  FunctionExpression: PRIMARY,
  ClassExpression: PRIMARY,
  TemplateLiteral: PRIMARY,
  JSXElement: PRIMARY,
  JSXFragment: PRIMARY,
}

/** The precedence the compiler gives the node holding an assertion, by its kind; an unparenthesised assertion only ever sits under a `new` with arguments or a prefix update. */
const HOLDERS: Readonly<Record<string, number>> = {
  SequenceExpression: COMMA,
  SpreadElement: SPREAD,
  YieldExpression: YIELD,
  AssignmentExpression: ASSIGNMENT,
  ConditionalExpression: CONDITIONAL,
  TSTypeAssertion: UNARY,
  TSNonNullExpression: UNARY,
  UnaryExpression: UNARY,
  AwaitExpression: UNARY,
  UpdateExpression: UNARY,
  CallExpression: LEFT_HAND_SIDE,
  ImportExpression: LEFT_HAND_SIDE,
  NewExpression: MEMBER,
  TaggedTemplateExpression: MEMBER,
  MemberExpression: MEMBER,
  MetaProperty: MEMBER,
  TSAsExpression: RELATIONAL,
  TSSatisfiesExpression: RELATIONAL,
  ArrowFunctionExpression: PRIMARY,
  ArrayExpression: PRIMARY,
}

export default defineRule<undefined, Node>({
  id: 'typescript/consistent-type-assertions',
  language: 'code',
  fixable: true,
  create: (context) => ({
    TSTypeAssertion(node) {
      const { text } = context.file
      const type = node.typeAnnotation as Node
      const expression = node.expression as Node
      const cast = text.slice(type.start, type.end)
      const value = wrap(text.slice(expression.start, expression.end), precedenceOf(expression), RELATIONAL)
      const asserted = `${value} as ${cast}`
      const parent = node.parent as Node
      const replacement = isParenthesised(context, node) ? asserted : wrap(asserted, RELATIONAL, holderPrecedenceOf(parent))
      context.report({
        start: node.start,
        end: node.end,
        message: `Use 'as ${cast}' instead of '<${cast}>'.`,
        fix: { start: node.start, end: node.end, text: replacement },
      })
    },
  }),
})

/**
 * Parenthesises text that binds no tighter than its surroundings.
 *
 * @param text - The text to be placed
 * @param inner - The precedence of what the text is
 * @param outer - The precedence of what holds it
 * @returns The text, in parentheses unless it binds tighter
 */
function wrap(text: string, inner: number, outer: number): string {
  return inner > outer ? text : `(${text})`
}

/**
 * The precedence of an asserted value, as the tree names it.
 *
 * @param node - The value
 * @returns Its precedence, lowest of all for a kind that has none
 */
function precedenceOf(node: Node): number {
  if (node.kind === 'BinaryExpression' || node.kind === 'LogicalExpression') return OPERATORS[node.operator as string] as number
  if (node.kind === 'ChainExpression') return precedenceOf(node.expression as Node)
  return VALUES[node.kind] ?? INVALID
}

/**
 * The precedence of the node holding an assertion, as the compiler names it.
 *
 * @param parent - The node holding the assertion
 * @returns Its precedence, lowest of all for a statement or declaration
 */
function holderPrecedenceOf(parent: Node): number {
  if (parent.kind === 'BinaryExpression' || parent.kind === 'LogicalExpression') return OPERATORS[parent.operator as string] as number
  return HOLDERS[parent.kind] ?? INVALID
}

/**
 * Whether an assertion sits in parentheses of its own, not those a call, construction or
 * dynamic import puts around its sole argument.
 *
 * @param context - The rule context
 * @param node - The assertion
 * @returns Whether the tokens around it are its own parentheses
 */
function isParenthesised(context: RuleContext<undefined, Node>, node: Node): boolean {
  const { text } = context.file
  const before = tokenBefore(context.tree, node.start)
  const after = tokenAfter(context.tree, node.end)
  if (before === null || after === null || text[before.start] !== '(' || text[after.start] !== ')') return false
  return before.start !== ownParenthesisOf(context, node.parent as Node, node)
}

/**
 * The offset of the parenthesis a holder opens before its sole argument, when the node is one.
 *
 * @param context - The rule context
 * @param parent - The node holding the assertion
 * @param node - The assertion
 * @returns The offset, or -1 when the holder opens no parenthesis of its own before the node
 */
function ownParenthesisOf(context: RuleContext<undefined, Node>, parent: Node, node: Node): number {
  let from = -1
  if (parent.kind === 'ImportExpression' && parent.source === node) from = parent.start
  else if (parent.kind === 'CallExpression' || parent.kind === 'NewExpression') {
    const args = parent.arguments as readonly Node[]
    if (args.length === 1 && args[0] === node) from = (parent.callee as Node).end
  }
  if (from === -1) return -1
  const open = tokensBetween(context.tree, from, node.start).find((token) => context.file.text[token.start] === '(') as SourceToken
  return open.start
}
