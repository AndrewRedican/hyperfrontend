/**
 * `!!x` and `Boolean(x)` where the value is read as a boolean anyway, in a condition, under
 * another `!` or inside another `Boolean()`, add nothing; the fix removes the cast and keeps
 * the parentheses the bare value then needs.
 *
 * @module rules/javascript/no-extra-boolean-cast
 */

import type { Node, SourceToken } from '../../code/model.ts'
import type { Fix } from '../../engine/report.ts'
import type { RuleContext } from '../../engine/rule.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { commentsBetween, tokenAfter, tokenBefore, tokenText } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'

/** What the helpers read of the rule's context. */
type Context = RuleContext<undefined, Node>

/** The kinds of node whose `test` is read as a boolean. */
const TESTS = createSet<string>(['IfStatement', 'DoWhileStatement', 'WhileStatement', 'ConditionalExpression', 'ForStatement'])

/** The kinds of expression that bind looser than a conditional's test. */
const LOOSE = createSet<string>([
  'SequenceExpression',
  'AssignmentExpression',
  'ArrowFunctionExpression',
  'YieldExpression',
  'ConditionalExpression',
])

/** The kinds of expression that bind looser than a `!` but tighter than a conditional's test. */
const OPERATORS = createSet<string>(['LogicalExpression', 'BinaryExpression'])

export default defineRule<undefined, Node>({
  id: 'no-extra-boolean-cast',
  language: 'code',
  fixable: true,
  create: (context) => ({
    UnaryExpression(node) {
      const parent = node.parent as Node
      if (node.operator !== '!' || parent.kind !== 'UnaryExpression' || parent.operator !== '!' || !isFlagged(parent)) return
      context.report({
        start: parent.start,
        end: parent.end,
        message: 'Redundant double negation.',
        fix: negationFix(context, parent, node.argument as Node),
      })
    },
    CallExpression(node) {
      const callee = node.callee as Node
      if (callee.kind !== 'Identifier' || callee.name !== 'Boolean' || !isFlagged(node)) return
      context.report({ start: node.start, end: node.end, message: 'Redundant Boolean call.', fix: callFix(context, node) })
    },
  }),
})

/**
 * Whether a node is a call of `Boolean`, with or without `new`.
 *
 * @param node - The node tested
 * @returns Whether it calls the global `Boolean`
 */
function isBooleanCall(node: Node): boolean {
  if (node.kind !== 'CallExpression' && node.kind !== 'NewExpression') return false
  const callee = node.callee as Node
  return callee.kind === 'Identifier' && callee.name === 'Boolean'
}

/**
 * Whether a node's value is read as a boolean: it is the argument of `Boolean()`, the test of a
 * condition or loop, or the operand of `!`; an optional chain around it is looked through.
 *
 * @param node - The node tested
 * @returns Whether a cast there is redundant
 */
function isFlagged(node: Node): boolean {
  const parent = node.parent as Node
  if (parent.kind === 'ChainExpression') return isFlagged(parent)
  if (isBooleanCall(parent)) return (parent.arguments as readonly Node[])[0] === node
  if (TESTS.has(parent.kind)) return parent.test === node
  return parent.kind === 'UnaryExpression' && parent.operator === '!'
}

/**
 * Whether a comment sits inside a node, where a fix would lose it.
 *
 * @param context - The rule's context
 * @param node - The node looked into
 * @returns Whether any comment lies within it
 */
function hasComments(context: Context, node: Node): boolean {
  return commentsBetween(context.file, node.start, node.end).length > 0
}

/**
 * The fix that replaces `!!value` by `value`.
 *
 * @param context - The rule's context
 * @param cast - The outer `!`
 * @param value - The operand of the inner `!`
 * @returns The fix, or undefined when a comment inside the cast would be lost
 */
function negationFix(context: Context, cast: Node, value: Node): Fix | undefined {
  if (hasComments(context, cast)) return undefined
  const text = context.file.text.slice(value.start, value.end)
  if (needsParentheses(context, cast, value)) return { start: cast.start, end: cast.end, text: `(${text})` }
  return { start: cast.start, end: cast.end, text: prefix(context, cast, tokenAfter(context.tree, value.start) as SourceToken) + text }
}

/**
 * The fix that replaces `Boolean(value)` by `value`, `Boolean()` by `false` and `!Boolean()` by
 * `true`.
 *
 * @param context - The rule's context
 * @param call - The `Boolean` call
 * @returns The fix, or undefined when the call spreads, takes several arguments or holds a comment
 */
function callFix(context: Context, call: Node): Fix | undefined {
  const callArguments = call.arguments as readonly Node[]
  const parent = call.parent as Node
  if (callArguments.length === 0) {
    if (parent.kind === 'UnaryExpression' && parent.operator === '!') {
      if (hasComments(context, parent)) return undefined
      return { start: parent.start, end: parent.end, text: `${prefix(context, parent, null)}true` }
    }
    return hasComments(context, call) ? undefined : { start: call.start, end: call.end, text: 'false' }
  }
  if (callArguments.length > 1) return undefined
  const value = callArguments[0] as Node
  if (value.kind === 'SpreadElement' || hasComments(context, call)) return undefined
  const text = context.file.text.slice(value.start, value.end)
  return { start: call.start, end: call.end, text: needsParentheses(context, call, value) ? `(${text})` : text }
}

/**
 * A space when the token before a cast would run into the first token of its replacement.
 *
 * @param context - The rule's context
 * @param cast - The node replaced
 * @param first - The replacement's first token, or null for the word `true`
 * @returns A space or nothing
 */
function prefix(context: Context, cast: Node, first: SourceToken | null): string {
  const before = tokenBefore(context.tree, cast.start)
  if (before === null || before.end !== cast.start) return ''
  return canBeAdjacent(context, before, first) ? '' : ' '
}

/**
 * Whether two tokens keep their meaning when written with nothing between them: a word runs
 * into a following word or number, except a private name or a number that starts with a dot.
 *
 * @param context - The rule's context
 * @param left - The token before
 * @param right - The token after, or null for the word `true`
 * @returns Whether no space is needed between them
 */
function canBeAdjacent(context: Context, left: SourceToken, right: SourceToken | null): boolean {
  if (left.category !== 'word') return true
  if (right === null) return false
  const text = tokenText(context.file, right)
  if (right.category === 'word') return text[0] === '#'
  return right.category !== 'number' || text[0] === '.'
}

/**
 * Whether a value needs parentheses in the place of the cast it replaces.
 *
 * @param context - The rule's context
 * @param cast - The node replaced
 * @param value - The value put in its place
 * @returns Whether the value binds looser than its new position allows
 */
function needsParentheses(context: Context, cast: Node, value: Node): boolean {
  const parent = cast.parent as Node
  if (parent.kind === 'ChainExpression') return needsParentheses(context, parent, value)
  if (isGrouped(context, cast)) return false
  if (parent.kind === 'CallExpression' || parent.kind === 'NewExpression') return value.kind === 'SequenceExpression'
  // why: the previous linter ranked no TypeScript expression and kept every one in parentheses.
  if (value.kind.startsWith('TS') || LOOSE.has(value.kind))
    return parent.kind === 'ConditionalExpression' || parent.kind === 'UnaryExpression'
  return parent.kind === 'UnaryExpression' && OPERATORS.has(value.kind)
}

/**
 * Whether a node sits in parentheses of its own, not the ones its parent opens for it as `if (`
 * or `f(` do.
 *
 * @param context - The rule's context
 * @param node - The node looked around
 * @returns Whether the parentheses around it are grouping ones
 */
function isGrouped(context: Context, node: Node): boolean {
  const { tree, file } = context
  const before = tokenBefore(tree, node.start)
  const after = tokenAfter(tree, node.end)
  if (before === null || after === null || file.text[before.start] !== '(' || file.text[after.start] !== ')') return false
  return before.start !== ownParenthesis(context, node)
}

/**
 * The offset of the parenthesis a node's parent opens for it, or -1 when the parent opens none.
 *
 * @param context - The rule's context
 * @param node - The node whose parent is read
 * @returns The offset of that opening parenthesis
 */
function ownParenthesis(context: Context, node: Node): number {
  const { tree, file } = context
  const parent = node.parent as Node
  let from = -1
  if (parent.kind === 'CallExpression' || parent.kind === 'NewExpression') {
    const callArguments = parent.arguments as readonly Node[]
    if (callArguments.length === 1 && callArguments[0] === node) from = (parent.callee as Node).end
  } else if (parent.kind === 'DoWhileStatement') {
    from = (parent.body as Node).end
  } else if (parent.kind === 'IfStatement' || parent.kind === 'WhileStatement') {
    from = parent.start
  }
  if (from === -1) return -1
  let token = tokenAfter(tree, from) as SourceToken
  while (file.text[token.start] !== '(') token = tokenAfter(tree, token.end) as SourceToken
  return token.start
}
