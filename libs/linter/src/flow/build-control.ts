/**
 * The builder's handling of the constructs that fork or jump: conditionals and short circuits,
 * loops, switches, labels, try statements and the statements that leave them.
 *
 * @module flow/build-control
 */

import type { Node } from '../code/model'
import type { Builder, Context } from './builder'
import type { Segment } from './model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { context } from './builder'

/** The kinds this module builds. */
const CONTROL = createSet<string>([
  'IfStatement',
  'ConditionalExpression',
  'LogicalExpression',
  'AssignmentExpression',
  'AssignmentPattern',
  'ChainExpression',
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'SwitchStatement',
  'LabeledStatement',
  'TryStatement',
  'BreakStatement',
  'ContinueStatement',
  'ReturnStatement',
  'ThrowStatement',
])

/** The statements a label attaches to rather than wrapping. */
const LABELLED_CONTROL = createSet<string>([
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'SwitchStatement',
])

/** The assignment operators that evaluate their right side only sometimes. */
const SHORT_CIRCUIT_ASSIGNMENTS = createSet<string>(['&&=', '||=', '??='])

/**
 * Whether a node forks or jumps.
 *
 * @param node - The node tested
 * @returns Whether this module builds it
 *
 * @example Optional member access forks, plain arithmetic does not
 * ```ts
 * // program parsed from 'user?.name; total + tax'
 * isControl(program.body[0].expression) // => true (a ChainExpression)
 * isControl(program.body[1].expression) // => false
 * ```
 */
export function isControl(node: Node): boolean {
  return CONTROL.has(node.kind) || ((node.kind === 'MemberExpression' || node.kind === 'CallExpression') && node.optional === true)
}

/**
 * Builds a forking or jumping node, which the builder has already recorded in its segment.
 *
 * @param b - The builder
 * @param node - The node built
 *
 * @example An if statement forks and its branches join after it
 * ```ts
 * // the builder hands over each forking node once recorded:
 * // if (isControl(node)) buildControl(builder, node)
 * const text = 'if (ready) start()\nelse stop()\ndone()'
 * const program = parseCode(text, '.ts').tree
 * const flow = analyzeFlow(program)
 * flow.segmentOf(program.body[1].expression).prevs.length // => 2
 * ```
 */
export function buildControl(b: Builder, node: Node): void {
  switch (node.kind) {
    case 'IfStatement':
      b.visit(node.test)
      fork(b, node.consequent as Node, node.alternate as Node | null)
      break
    case 'ConditionalExpression':
      b.visit(node.test)
      fork(b, node.consequent as Node, node.alternate as Node)
      break
    case 'LogicalExpression':
      b.visit(node.left)
      fork(b, node.right as Node, null)
      break
    case 'AssignmentExpression':
      buildAssignment(b, node)
      break
    case 'AssignmentPattern':
      // why: a default is evaluated only when nothing was supplied.
      b.visit(node.left)
      fork(b, node.right as Node, null)
      break
    case 'ChainExpression':
      buildChain(b, node)
      break
    case 'WhileStatement':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
      buildLoop(b, node)
      break
    case 'DoWhileStatement':
      buildDoWhile(b, node)
      break
    case 'SwitchStatement':
      buildSwitch(b, node)
      break
    case 'LabeledStatement':
      buildLabeled(b, node)
      break
    case 'TryStatement':
      buildTry(b, node)
      break
    case 'BreakStatement':
    case 'ContinueStatement':
      b.leave({ kind: node.kind === 'BreakStatement' ? 'break' : 'continue', label: labelOf(node), segment: b.current() })
      break
    case 'ReturnStatement':
    case 'ThrowStatement':
      b.visit(node.argument)
      b.leave({ kind: node.kind === 'ReturnStatement' ? 'return' : 'throw', label: null, segment: b.current() })
      break
    default:
      buildOptional(b, node)
  }
}

/**
 * The label a jump names, or null.
 *
 * @param node - The break or continue statement
 * @returns The label's name
 */
function labelOf(node: Node): string | null {
  const label = node.label as Node | null
  return label === null ? null : (label.name as string)
}

/**
 * Builds two branches from the current heads and joins them: each branch gets a segment of its
 * own; a missing branch flows straight from the fork.
 *
 * @param b - The builder
 * @param consequent - The branch taken when the test holds
 * @param alternate - The other branch, or null when there is none
 */
function fork(b: Builder, consequent: Node, alternate: Node | null): void {
  const from = b.heads
  b.segment(from)
  b.visit(consequent)
  const afterConsequent = b.heads
  b.heads = from
  if (alternate !== null) {
    b.segment(from)
    b.visit(alternate)
  }
  b.heads = [...afterConsequent, ...b.heads]
}

/**
 * Builds an assignment: the right side before the name it writes, so the reads come first; a
 * short-circuit assignment reads its target and may skip the right side.
 *
 * @param b - The builder
 * @param node - The assignment built
 */
function buildAssignment(b: Builder, node: Node): void {
  if (SHORT_CIRCUIT_ASSIGNMENTS.has(node.operator as string)) {
    b.visit(node.left)
    fork(b, node.right as Node, null)
    return
  }
  b.visit(node.right)
  b.visit(node.left)
}

/**
 * Builds an optional chain: each optional link may leave the chain for its end.
 *
 * @param b - The builder
 * @param node - The chain built
 */
function buildChain(b: Builder, node: Node): void {
  const chain = context('chain', null)
  b.contexts.push(chain)
  b.visit(node.expression as Node)
  b.contexts.pop()
  b.heads = [...b.heads, ...chain.breaks]
}

/**
 * Builds an optional member or call: its object or callee, a fork that leaves the chain, then
 * the rest in a new segment.
 *
 * @param b - The builder
 * @param node - The optional member or call
 */
function buildOptional(b: Builder, node: Node): void {
  const chain = b.innermost('chain') as Context
  if (node.kind === 'MemberExpression') {
    b.visit(node.object)
    chain.breaks.push(b.current())
    b.segment()
    if (node.computed === true) b.visit(node.property)
    return
  }
  b.visit(node.callee)
  chain.breaks.push(b.current())
  b.segment()
  for (const argument of node.arguments as readonly Node[]) b.visit(argument)
}

/**
 * Whether a loop's test can only hold: absent, or a literal that is truthy.
 *
 * @param test - The test, or nothing
 * @returns Whether the loop can only be left by a jump
 */
function alwaysTrue(test: Node | null | undefined): boolean {
  if (test === null || test === undefined) return true
  if (test.kind !== 'Literal') return false
  if (test.regex !== undefined) return true
  return test.value !== null && test.value !== false && test.value !== 0 && test.value !== ''
}

/**
 * Builds a while, for, for-in or for-of loop: a test segment entered from before and from the
 * body's end, the body, the update, and the exits from wherever the test ends or by a break.
 *
 * @param b - The builder
 * @param node - The loop built
 */
function buildLoop(b: Builder, node: Node): void {
  const loop = context('loop', labelFor(node))
  if (node.kind === 'ForStatement') b.visit(node.init)
  if (node.kind === 'ForInStatement' || node.kind === 'ForOfStatement') b.visit(node.right)
  const test = b.segment()
  if (node.kind === 'WhileStatement' || node.kind === 'ForStatement') b.visit(node.test)
  else b.visit(node.left)
  const tested = b.heads
  b.segment()
  b.contexts.push(loop)
  b.visit(node.body as Node)
  b.contexts.pop()
  b.heads = [...b.heads, ...loop.continues]
  if (node.kind === 'ForStatement' && node.update !== null && node.update !== undefined) {
    b.segment()
    b.visit(node.update)
  }
  for (const head of b.heads) test.link(head)
  const leaves = (node.kind === 'WhileStatement' || node.kind === 'ForStatement') && alwaysTrue(node.test) ? [] : tested
  b.heads = [...leaves, ...loop.breaks]
}

/**
 * Builds a do-while loop: the body, then the test, entered from the body's end and continues,
 * with edges back to the body and exits from wherever the test ends, and the exits by a break.
 *
 * @param b - The builder
 * @param node - The loop built
 */
function buildDoWhile(b: Builder, node: Node): void {
  const loop = context('loop', labelFor(node))
  const body = b.segment()
  b.contexts.push(loop)
  b.visit(node.body as Node)
  b.contexts.pop()
  b.heads = [...b.heads, ...loop.continues]
  let leaves: Segment[] = []
  if (b.heads.length > 0) {
    b.segment()
    b.visit(node.test)
    for (const head of b.heads) body.link(head)
    if (!alwaysTrue(node.test)) leaves = b.heads
  }
  b.heads = [...leaves, ...loop.breaks]
}

/**
 * The label a statement carries, or null.
 *
 * @param node - The statement
 * @returns The label's name
 */
function labelFor(node: Node): string | null {
  const parent = node.parent as Node
  return parent.kind === 'LabeledStatement' ? ((parent.label as Node).name as string) : null
}

/**
 * Builds a switch: the discriminant, each case's test in turn, each case's statements entered
 * from its test or by falling through from the one before, the default entered when no test
 * held, and the breaks that leave.
 *
 * @param b - The builder
 * @param node - The switch built
 */
function buildSwitch(b: Builder, node: Node): void {
  b.visit(node.discriminant)
  const control = context('switch', labelFor(node))
  b.contexts.push(control)
  let untested: Segment[] = b.heads
  let fallen: Segment[] = []
  let defaultEntry: Segment | null = null
  for (const switchCase of node.cases as readonly Node[]) {
    const test = switchCase.test as Node | null
    if (test !== null) {
      b.heads = untested
      b.segment()
      b.visit(test)
      untested = b.heads
    }
    const entry = b.segment(test === null ? fallen : [...fallen, ...untested])
    if (test === null) defaultEntry = entry
    b.statements(switchCase.consequent as readonly Node[])
    b.caseEnds.set(switchCase, b.heads)
    fallen = b.heads
  }
  if (defaultEntry !== null) for (const head of untested) defaultEntry.link(head)
  b.contexts.pop()
  b.heads = [...fallen, ...(defaultEntry === null ? untested : []), ...control.breaks]
}

/**
 * Builds a labelled statement: a loop or switch carries the label itself; any other body gets
 * a construct the breaks naming the label leave.
 *
 * @param b - The builder
 * @param node - The labelled statement
 */
function buildLabeled(b: Builder, node: Node): void {
  const body = node.body as Node
  if (LABELLED_CONTROL.has(body.kind)) {
    b.visit(body)
    return
  }
  const label = context('label', (node.label as Node).name as string)
  b.contexts.push(label)
  b.visit(body)
  b.contexts.pop()
  b.heads = [...b.heads, ...label.breaks]
}

/**
 * Builds a try statement: the block, from any segment of which an exception may reach the
 * catch; the catch; the finally, which every exit of the block and the catch passes through.
 *
 * @param b - The builder
 * @param node - The try statement
 */
function buildTry(b: Builder, node: Node): void {
  const handler = node.handler as Node | null
  const finalizer = node.finalizer as Node | null
  const attempt = context('try', null)
  attempt.catches = handler !== null
  attempt.finalises = finalizer !== null
  b.contexts.push(attempt)
  b.segment()
  b.visit(node.block as Node)
  let normal = b.heads
  let implicit = attempt.implicit.splice(0)
  if (handler !== null) {
    attempt.catches = false
    const entry = b.segment([...normal, ...attempt.throws.splice(0)])
    // why: an exception may leave any segment of the block at any point, the one that also flows in normally included.
    for (const source of implicit) entry.linkThrown(source)
    b.visit(handler.param)
    b.visit(handler.body as Node)
    normal = [...normal, ...b.heads]
    implicit = attempt.implicit.splice(0)
  }
  b.contexts.pop()
  if (finalizer === null) {
    const outer = b.innermost('try')
    // why: a long catch block leaves more segments than one call accepts as spread arguments.
    if (outer !== null) for (const segment of implicit) outer.implicit.push(segment)
    b.heads = normal
    return
  }
  const passing = attempt.passing.splice(0)
  const entry = b.segment([...normal, ...passing.map((jump) => jump.segment)])
  for (const source of implicit) entry.linkThrown(source)
  b.visit(finalizer)
  const end = b.heads
  for (const jump of passing) {
    b.heads = end
    if (end.length > 0) b.leave({ kind: jump.kind, label: jump.label, segment: b.current() })
  }
  b.heads = normal.length === 0 ? [] : end
}
