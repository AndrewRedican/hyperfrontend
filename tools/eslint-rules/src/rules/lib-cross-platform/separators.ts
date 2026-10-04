import type { TSESTree } from '@typescript-eslint/utils'
import type { ImportPlan } from './imports'
import type { FlavourEdit } from './report'
import type { Piece } from './segments'
import type { CheckContext, Flavour, Tier } from './types'
import { ASTUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'
import { calleeName, isConcatOperand, methodName, propertyName, regexOf, stringValue, unwrap } from './ast'
import { bindingOfVariable, knownValueOf } from './bindings'
import { callResultKind, wordsOf } from './domain'
import { planPathExport } from './imports'
import { fixWith, reportTiered, strongestTier } from './report'
import { expressionSource, joinArguments, piecesOf, renderWithSeparator } from './segments'
import { conversionShape, isBackslash, isConversionSplit, isSlash, separatorFlavour } from './shapes'

/**
 * String methods whose first argument is matched against the receiver's separators.
 */
const SEPARATOR_METHODS: readonly string[] = [
  'split',
  'indexOf',
  'lastIndexOf',
  'startsWith',
  'endsWith',
  'includes',
  'replace',
  'replaceAll',
]

/**
 * Of those, the methods that also accept a regular expression.
 */
const REGEX_METHODS: readonly string[] = ['split', 'replace', 'replaceAll']

/**
 * Leading text that marks a built string as a relative specifier or rooted URL, not a path join.
 */
const SKIPPED_HEADS: readonly string[] = ['./', '../', '/']

/**
 * Text that marks a built string as a URL or query rather than a filesystem path.
 */
const NON_PATH_MARKERS: readonly string[] = ['://', '?', '#']

/**
 * Words that mark a value as a URL, whose separators are always `/`.
 */
const URL_WORDS: readonly string[] = ['url', 'uri', 'href']

/**
 * How many variable hops the drive-letter check follows to find where a list came from.
 */
const MAX_HOPS = 8

/**
 * What a separator-matching argument is made of.
 */
interface SeparatorArgument {
  /** `exact` is a lone separator, `contains` a literal with `/`, `built` a template or concatenation, `regex` a pattern. */
  kind: 'exact' | 'contains' | 'built' | 'regex'
  /** Interpolated expressions inside a built argument. */
  expressions: TSESTree.Node[]
}

/**
 * Tests whether a regex source escapes a forward slash and never a backslash, meaning it
 * only matches POSIX separators.
 *
 * @param pattern - The regex source.
 * @returns True for a forward-slash-only pattern.
 */
function matchesOnlyForwardSlash(pattern: string): boolean {
  let slash = false
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] !== '\\') continue
    if (pattern[index + 1] === '\\') return false
    if (pattern[index + 1] === '/') slash = true
    index += 1
  }
  return slash
}

/**
 * Describes the argument of a separator-matching method call.
 *
 * @param arg - The first argument.
 * @param method - The method called.
 * @returns The argument's makeup, or null when it does not mention a separator.
 */
function separatorArgument(arg: TSESTree.Node, method: string): SeparatorArgument | null {
  const value = stringValue(arg)
  if (value !== null) {
    if (value === '/' || value === '\\') return { kind: 'exact', expressions: [] }
    return value.includes('/') ? { kind: 'contains', expressions: [] } : null
  }
  if (arg.type === AST_NODE_TYPES.TemplateLiteral || (arg.type === AST_NODE_TYPES.BinaryExpression && arg.operator === '+')) {
    const pieces = piecesOf(arg)
    if (!pieces.some((piece) => piece.kind === 'text' && piece.value.includes('/'))) return null
    return { kind: 'built', expressions: pieces.flatMap((piece) => (piece.kind === 'expression' ? [piece.node] : [])) }
  }
  const regex = regexOf(arg)
  return regex && REGEX_METHODS.includes(method) && matchesOnlyForwardSlash(regex.pattern) ? { kind: 'regex', expressions: [] } : null
}

/**
 * Lists the operands of a `+` chain that spell out a `/`.
 *
 * @param node - The `+` chain.
 * @returns String literals and templates containing `/`.
 */
function slashOperands(node: TSESTree.Node): TSESTree.Node[] {
  if (node.type === AST_NODE_TYPES.BinaryExpression && node.operator === '+')
    return [...slashOperands(node.left), ...slashOperands(node.right)]
  return isBackslash(node) || piecesOf(node).some((piece) => piece.kind === 'text' && piece.value.includes('/')) ? [node] : []
}

/**
 * Builds the edit that swaps every `/` written in a string for `sep` or `posix.sep`.
 *
 * @param check - The check context.
 * @param node - A string literal, template literal, or `+` chain.
 * @param flavour - Which separator to use.
 * @returns The edit, or null when the separator cannot be referenced.
 */
function slashEdit(check: CheckContext, node: TSESTree.Node, flavour: Flavour): FlavourEdit | null {
  const plan = planPathExport(check.sourceCode, node, flavour, 'sep')
  if (!plan) return null
  const [separator] = plan.texts
  const render = (operand: TSESTree.Node): string =>
    isSlash(operand) || isBackslash(operand) ? separator : renderWithSeparator(piecesOf(operand), separator, check.sourceCode)
  const operands = node.type === AST_NODE_TYPES.BinaryExpression ? slashOperands(node) : [node]
  return {
    replacement: operands.length === 1 ? render(operands[0]) : separator,
    fix: (fixer) => [...plan.fixes(fixer), ...operands.map((operand) => fixer.replaceText(operand, render(operand)))],
  }
}

/**
 * Builds the edit for a separator argument.
 *
 * @param check - The check context.
 * @param arg - The separator argument.
 * @param shape - The argument's makeup.
 * @param flavour - Which separator to use.
 * @returns The edit, or null when it cannot be made safely.
 */
function separatorEdit(check: CheckContext, arg: TSESTree.Node, shape: SeparatorArgument, flavour: Flavour): FlavourEdit | null {
  if (shape.kind === 'regex' || (flavour === 'portable' && isBackslash(arg))) return null
  return slashEdit(check, arg, flavour)
}

/**
 * Builds the edit that turns `p.startsWith('/')` into `isAbsolute(p)`.
 *
 * @param check - The check context.
 * @param call - The `startsWith` call.
 * @param callee - Its member callee.
 * @param flavour - Which `isAbsolute` to use.
 * @returns The edit, or null when it cannot be made safely.
 */
function absoluteEdit(
  check: CheckContext,
  call: TSESTree.CallExpression,
  callee: TSESTree.MemberExpression,
  flavour: Flavour
): FlavourEdit | null {
  if (callee.optional) return null
  const plan = planPathExport(check.sourceCode, call, flavour, 'isAbsolute')
  if (!plan) return null
  const replacement = `${plan.texts[0]}(${expressionSource(callee.object, check.sourceCode)})`
  return { replacement, fix: fixWith(plan, (fixer) => fixer.replaceText(call, replacement)) }
}

/**
 * Reports separator literals matched against native paths, and `startsWith('/')` used as an
 * absolute-path test on them.
 *
 * @param check - The check context.
 * @param call - A call expression.
 */
export function checkSeparatorMethod(check: CheckContext, call: TSESTree.CallExpression): void {
  const callee = call.callee
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return
  const method = propertyName(callee)
  const [arg] = call.arguments
  if (method === null || !SEPARATOR_METHODS.includes(method) || !arg || arg.type === AST_NODE_TYPES.SpreadElement) return
  if (isConversionSplit(call, check.binding) || conversionShape(call, check.binding)) return
  const shape = separatorArgument(arg, method)
  if (!shape) return
  const tier = strongestTier([callee.object, ...shape.expressions].map((node) => check.tierOf(node)))
  if (tier === 0) return
  if (method === 'startsWith' && isSlash(arg)) {
    reportTiered(check, call, 'absoluteCheck', tier, (flavour) => absoluteEdit(check, call, callee, flavour))
    return
  }
  reportTiered(check, call, 'separatorLiteral', tier, (flavour) => separatorEdit(check, arg, shape, flavour), { method })
}

/**
 * Tests whether a node is the separator argument of a method {@link checkSeparatorMethod} owns.
 *
 * @param node - The node to test.
 * @returns True when the node is that argument.
 */
function isSeparatorArgument(node: TSESTree.Node): boolean {
  const call = node.parent
  if (call?.type !== AST_NODE_TYPES.CallExpression || call.arguments[0] !== node) return false
  const method = methodName(call)
  return method !== null && SEPARATOR_METHODS.includes(method)
}

/**
 * Plans the native `join` an edit calls: an existing native `join` binding when there is one,
 * otherwise `join` from `node:path`.
 *
 * @param check - The check context.
 * @param at - The node being replaced.
 * @returns The plan, or null when `join` names something else.
 */
function planNativeJoin(check: CheckContext, at: TSESTree.Node): ImportPlan | null {
  const variable = ASTUtils.findVariable(check.sourceCode.getScope(at), 'join')
  const reference = variable ? bindingOfVariable(variable, check.binding) : null
  if (reference && callResultKind(reference, check.helpers) === 'native') return { texts: ['join'], fixes: () => [] }
  return planPathExport(check.sourceCode, at, 'native', 'join')
}

/**
 * Builds the edit that turns a `/`-joined string into a `join(...)` call, or, when a leading,
 * trailing, or doubled `/` rules that out, into the same string with `sep` interpolated.
 *
 * @param check - The check context.
 * @param node - The template literal or `+` chain.
 * @param pieces - Its pieces.
 * @param flavour - Which `join` to call.
 * @returns The edit, or null when it cannot be made safely.
 */
function joinEdit(check: CheckContext, node: TSESTree.Node, pieces: readonly Piece[], flavour: Flavour): FlavourEdit | null {
  const args = joinArguments(pieces, check.sourceCode)
  if (!args) return slashEdit(check, node, flavour)
  const plan = flavour === 'native' ? planNativeJoin(check, node) : planPathExport(check.sourceCode, node, 'portable', 'join')
  if (!plan) return null
  const replacement = `${plan.texts[0]}(${args.join(', ')})`
  return { replacement, fix: fixWith(plan, (fixer) => fixer.replaceText(node, replacement)) }
}

/**
 * Tests whether a node is a template literal or `+` chain worth analysing on its own: not
 * tagged, and not, even through a conditional or fallback, part of a larger built string.
 *
 * @param node - A template literal or binary expression.
 * @returns True when the node is a standalone built string.
 */
function isStandaloneBuild(node: TSESTree.TemplateLiteral | TSESTree.BinaryExpression): boolean {
  if (node.type === AST_NODE_TYPES.BinaryExpression && node.operator !== '+') return false
  if (node.parent?.type === AST_NODE_TYPES.TaggedTemplateExpression) return false
  let child: TSESTree.Node = node
  let parent: TSESTree.Node | undefined = node.parent
  while (
    parent?.type === AST_NODE_TYPES.LogicalExpression ||
    (parent?.type === AST_NODE_TYPES.ConditionalExpression && parent.test !== child)
  ) {
    child = parent
    parent = parent.parent
  }
  return parent?.type !== AST_NODE_TYPES.TemplateLiteral && !isConcatOperand(child)
}

/**
 * Reports `/` written next to a native path inside a template or concatenation.
 *
 * @param check - The check context.
 * @param node - A template literal or binary expression.
 */
export function checkSeparatorJoin(check: CheckContext, node: TSESTree.TemplateLiteral | TSESTree.BinaryExpression): void {
  if (!isStandaloneBuild(node) || isSeparatorArgument(node)) return
  const pieces = piecesOf(node)
  const texts = pieces.flatMap((piece) => (piece.kind === 'text' ? [piece.value] : []))
  const head = pieces[0]?.kind === 'text' ? pieces[0].value : ''
  if (texts.length === 0 || SKIPPED_HEADS.some((prefix) => head.startsWith(prefix))) return
  if (texts.some((text) => /\s/.test(text) || NON_PATH_MARKERS.some((marker) => text.includes(marker)))) return
  if (namesOfBuild(node, pieces).some((name) => wordsOf(name).some((word) => URL_WORDS.includes(word)))) return
  const tiers: Tier[] = pieces.flatMap((piece, index) => {
    if (piece.kind !== 'expression') return []
    const before = pieces[index - 1]
    const after = pieces[index + 1]
    const adjacent = (before?.kind === 'text' && before.value.endsWith('/')) || (after?.kind === 'text' && after.value.startsWith('/'))
    return adjacent ? [check.tierOf(piece.node)] : []
  })
  const tier = strongestTier(tiers)
  if (tier === 0) return
  reportTiered(check, node, 'separatorJoin', tier, (flavour) => joinEdit(check, node, pieces, flavour))
}

/**
 * Reads the static name of a value: identifier, property, or called function.
 *
 * @param node - The expression.
 * @returns The name, or null when the expression has none.
 */
function nameOf(node: TSESTree.Node): string | null {
  const expr = unwrap(node)
  if (expr.type === AST_NODE_TYPES.Identifier) return expr.name
  if (expr.type === AST_NODE_TYPES.MemberExpression) return propertyName(expr)
  return expr.type === AST_NODE_TYPES.CallExpression ? calleeName(expr) : null
}

/**
 * Lists the names that say what a built string is: those of its interpolated values and of
 * the variable or property it is stored in.
 *
 * @param node - The template literal or `+` chain.
 * @param pieces - Its pieces.
 * @returns The names found.
 */
function namesOfBuild(node: TSESTree.Node, pieces: readonly Piece[]): string[] {
  const parent = node.parent
  let destination: TSESTree.Node | null = null
  if (parent?.type === AST_NODE_TYPES.VariableDeclarator) destination = parent.id
  else if (parent?.type === AST_NODE_TYPES.Property) destination = parent.key
  else if (parent?.type === AST_NODE_TYPES.AssignmentExpression) destination = parent.left
  const named = [...pieces.flatMap((piece) => (piece.kind === 'expression' ? [piece.node] : [])), ...(destination ? [destination] : [])]
  return named.flatMap((expr) => {
    const name = nameOf(expr)
    return name === null ? [] : [name]
  })
}

/**
 * Follows a method chain and its variables back to the value it started from.
 *
 * @param node - The end of the chain.
 * @param check - The check context.
 * @returns The receiver or value the chain starts from.
 */
function chainOrigin(node: TSESTree.Node, check: CheckContext): TSESTree.Node {
  let current = unwrap(node)
  let hops = 0
  for (;;) {
    if (current.type === AST_NODE_TYPES.CallExpression && current.callee.type === AST_NODE_TYPES.MemberExpression)
      current = unwrap(current.callee.object)
    else if (current.type === AST_NODE_TYPES.MemberExpression) current = unwrap(current.object)
    else {
      const value = current.type === AST_NODE_TYPES.Identifier && hops < MAX_HOPS ? knownValueOf(current, check.sourceCode) : null
      if (!value) return current
      current = unwrap(value)
      hops += 1
    }
  }
}

/**
 * Reports an absolute path rebuilt as `'/' + segments.join('/')`, which turns `C:\x` into
 * `/C:/x` on Windows.
 *
 * @param check - The check context.
 * @param node - A template literal or binary expression.
 */
export function checkDriveLetterLoss(check: CheckContext, node: TSESTree.TemplateLiteral | TSESTree.BinaryExpression): void {
  if (!check.nodeCapable || !isStandaloneBuild(node)) return
  const [head, first] = piecesOf(node)
  if (head?.kind !== 'text' || head.value !== '/' || first?.kind !== 'expression') return
  const call = unwrap(first.node)
  if (call.type !== AST_NODE_TYPES.CallExpression || methodName(call) !== 'join') return
  const [separator] = call.arguments
  if (!isSlash(separator) && separatorFlavour(separator, check.binding) === null) return
  if (check.classify(chainOrigin(call, check)).kind === 'relative') return
  check.context.report({ node, messageId: 'driveLetterLoss' })
}
