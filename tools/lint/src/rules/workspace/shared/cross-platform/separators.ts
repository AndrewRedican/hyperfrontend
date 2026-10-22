/**
 * The separator checks: a hardcoded `/` matched against a native path, `startsWith('/')` as an
 * absolute-path test, `/` written between native segments, an absolute path rebuilt without its
 * drive, a native-to-POSIX conversion in a spelling other than the canonical one, a `relative()`
 * result leaving as data, and a split on a bare line feed.
 *
 * @module rules/workspace/shared/cross-platform/separators
 */

import type { Node, RegexValue, TemplateValue } from '../../../../code/model.ts'
import type { Fix } from '../../../../engine/report.ts'
import type { Rewrite, Scan } from './edits.ts'
import type { Part } from './origin.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { mergeEdits } from '../../../typescript/shared/edits.ts'
import { argumentText, quote, reportTiered, templateText } from './edits.ts'
import { combine, isQualified, isUrlName, MAX_HOPS, nameOf, partsOf, stringOf, unwrap } from './origin.ts'

/** The messages of these checks. */
const MESSAGES = {
  separatorLiteral:
    "`.{{ method }}()` matches a hardcoded '/' against a native path, which uses '\\' on Windows. Match `sep` from node:path, or convert the path first with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.",
  absoluteCheck: "`startsWith('/')` never matches a Windows absolute path such as 'C:\\x'. Use `isAbsolute()` from node:path.",
  separatorJoin:
    "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
  relativeEscapes:
    '`relative()` returns backslashes on Windows, and this result leaves as data (a key, an Nx root, a stored or returned value). Convert it with `relativePath` or `workspaceRelativePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.',
  driveLetterLoss:
    "Rebuilding an absolute path as '/' plus joined segments drops the drive on Windows: 'C:\\x' becomes '/C:/x'. Walk up with `dirname()` instead.",
  posixConversion:
    'Convert native paths to POSIX with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported. This spelling also rewrites backslashes on POSIX, where they are legal file-name characters.',
  lineSplit: "Splitting on a bare line feed leaves '\\r' on every line of a CRLF file. Split on `/\\r?\\n/`.",
} as const

/** The string methods that match a separator. */
const SEPARATOR_METHODS = createSet(['split', 'indexOf', 'lastIndexOf', 'startsWith', 'endsWith', 'includes', 'replace', 'replaceAll'])

/** The collection methods a `relative()` result is stored through. */
const STORING_METHODS = createSet(['push', 'unshift', 'add', 'set', 'has', 'get'])

/** The expressions a value passes through unchanged on its way to where it is used. */
const PASSING = createSet(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'ChainExpression'])

/** What a built string's text must not hold for it to be a path: whitespace, a scheme, a query or a fragment. */
const NOT_A_PATH = /\s|:\/\/|[?#]/

/** A call of a method named in the source. */
export interface MethodCall {
  /** The member expression called. */
  readonly member: Node
  /** The method's name. */
  readonly name: string
}

/** The arguments of a split and join conversion. */
interface Halves {
  /** What the split splits on. */
  readonly split: Node
  /** What the join joins with. */
  readonly join: Node
}

/**
 * The method a call invokes by a written-out name.
 *
 * @param call - A call, or any other node
 * @returns The member callee and the method name, or null
 */
export function methodOf(call: Node): MethodCall | null {
  if (call.kind !== 'CallExpression') return null
  const member = unwrap(call.callee as Node)
  if (member.kind !== 'MemberExpression' || member.computed === true || (member.property as Node).kind !== 'Identifier') return null
  return { member, name: (member.property as Node).name as string }
}

/**
 * A node with `/` replaced by the separator: a literal or a template, or the text operands of a chain.
 *
 * @param scan - The file's checks
 * @param node - The literal, template or chain
 * @param separator - The separator's expression
 * @returns The replacements of the literal, the template, or each of the chain's text operands
 */
function slashEdits(scan: Scan, node: Node, separator: string): Fix[] {
  if (node.kind === 'BinaryExpression')
    return [...slashEdits(scan, node.left as Node, separator), ...slashEdits(scan, node.right as Node, separator)]
  const value = stringOf(node)
  if (value === '/' || value === '\\') return [{ start: node.start, end: node.end, text: separator }]
  if (!matchesSeparator(node)) return []
  const pieces = partsOf(node).map((part) =>
    part.text === null
      ? `\${${scan.text.slice(part.node.start, part.node.end)}}`
      : part.text.split('/').map(templateText).join(`\${${separator}}`)
  )
  return [{ start: node.start, end: node.end, text: `\`${pieces.join('')}\`` }]
}

/**
 * Whether an argument matches a separator: a string or template holding `/` or a lone `\`, a
 * chain with such text, or a regex escaping `/` but never `\`.
 *
 * @param node - The argument
 * @returns Whether it does
 */
function matchesSeparator(node: Node): boolean {
  if (node.kind === 'Literal' && node.regex !== undefined) {
    const { pattern } = node.regex as RegexValue
    return pattern.includes('\\/') && !pattern.includes('\\\\')
  }
  if (node.kind !== 'Literal' && node.kind !== 'TemplateLiteral' && !(node.kind === 'BinaryExpression' && node.operator === '+'))
    return false
  return stringOf(node) === '\\' || partsOf(node).some((part) => part.text?.includes('/') === true)
}

/**
 * Whether a call is the `.join()` half of a conversion the posixConversion check reports.
 *
 * @param scan - The file's checks
 * @param call - A call, or any other node
 * @returns The split call's argument and the join's, when it is
 */
function splitJoin(scan: Scan, call: Node): Halves | null {
  const method = methodOf(call)
  const split = method === null ? null : unwrap(method.member.object as Node)
  const splitMethod = split?.kind === 'CallExpression' ? methodOf(split) : null
  if (method?.name !== 'join' || splitMethod?.name !== 'split') return null
  const splitArgument = ((split as Node).arguments as readonly Node[])[0]
  const joinArgument = (call.arguments as readonly Node[])[0]
  if (splitArgument === undefined || joinArgument === undefined) return null
  const native = stringOf(splitArgument) === '\\' || isQualified(scan.tracer.qualify(splitArgument), 'path:sep')
  const slash = stringOf(joinArgument) === '/' || isQualified(scan.tracer.qualify(joinArgument), 'path/posix:sep')
  if (!native || !slash || (stringOf(splitArgument) !== '\\' && stringOf(joinArgument) !== '/')) return null
  return { split: splitArgument, join: joinArgument }
}

/**
 * Checks a native-to-POSIX conversion: `.replace(/\\/g, '/')`, `.replaceAll('\\', '/')`, or a
 * split and join that is not `.split(sep).join(posix.sep)`.
 *
 * @param scan - The file's checks
 * @param call - A method call
 * @returns Whether the call was reported
 */
function checkConversion(scan: Scan, call: Node): boolean {
  const method = methodOf(call) as MethodCall
  const [from, to] = call.arguments as readonly (Node | undefined)[]
  const halves = splitJoin(scan, call)
  const regex = from?.regex as RegexValue | undefined
  const replaced =
    (method.name === 'replace' || method.name === 'replaceAll') &&
    to !== undefined &&
    (stringOf(to) === '/' || isQualified(scan.tracer.qualify(to), 'path/posix:sep')) &&
    ((regex?.pattern === '\\\\' && regex.flags.includes('g')) || (method.name === 'replaceAll' && stringOf(from) === '\\'))
  if (halves === null && !replaced) return false
  const names =
    halves === null
      ? ['sep', 'posix']
      : [...(stringOf(halves.split) === '\\' ? ['sep'] : []), ...(stringOf(halves.join) === '/' ? ['posix'] : [])]
  const naming = scan.nodeImports ? scan.namer('path', names, call) : null
  let fix: Fix | null = null
  if (naming !== null) {
    const text = (name: string): string => naming.texts[names.indexOf(name)] as string
    const edits: Fix[] =
      halves === null
        ? [{ start: (method.member.property as Node).start, end: call.end, text: `split(${text('sep')}).join(${text('posix')}.sep)` }]
        : [
            ...(names.includes('sep') ? [{ start: halves.split.start, end: halves.split.end, text: text('sep') }] : []),
            ...(names.includes('posix') ? [{ start: halves.join.start, end: halves.join.end, text: `${text('posix')}.sep` }] : []),
          ]
    fix = mergeEdits(scan.text, [...naming.edits, ...edits])
  }
  scan.report(call, MESSAGES.posixConversion, fix)
  return true
}

/**
 * Checks a call of a string method: a split on a bare line feed, a conversion, an absolute-path
 * test, or a separator matched against a native path.
 *
 * @param scan - The file's checks
 * @param call - Any call
 */
export function checkMethodCall(scan: Scan, call: Node): void {
  const method = methodOf(call)
  const argument = (call.arguments as readonly Node[])[0]
  if (method === null || argument === undefined) return
  const value = stringOf(argument)
  if (method.name === 'split' && (value === '\n' || value === '\r\n')) {
    scan.report(argument, MESSAGES.lineSplit, { start: argument.start, end: argument.end, text: '/\\r?\\n/' })
    return
  }
  if (scan.node && checkConversion(scan, call)) return
  if (!SEPARATOR_METHODS.has(method.name)) return
  const receiver = method.member.object as Node
  if (method.name === 'startsWith' && value === '/') {
    const optional = method.member.optional === true || call.optional === true
    reportTiered(scan, call, MESSAGES.absoluteCheck, scan.tracer.originOf(receiver), (portable) => {
      const naming = optional ? null : scan.namer('path', [portable ? 'posix' : 'isAbsolute'], call)
      if (naming === null) return null
      const replacement = `${naming.texts[0] as string}${portable ? '.isAbsolute' : ''}(${argumentText(scan.text, receiver)})`
      return { replacement, edits: [...naming.edits, { start: call.start, end: call.end, text: replacement }] }
    })
    return
  }
  if (!matchesSeparator(argument)) return
  const parent = call.parent as Node
  if (method.name === 'split' && parent.kind === 'MemberExpression' && splitJoin(scan, parent.parent as Node) !== null) return
  const parts = argument.kind === 'Literal' ? [] : partsOf(argument).filter((part) => part.text === null)
  const origin = combine([scan.tracer.originOf(receiver), ...parts.map((part) => scan.tracer.originOf(part.node))])
  const backslash = value === '\\'
  reportTiered(
    scan,
    call,
    MESSAGES.separatorLiteral.replace('{{ method }}', method.name),
    origin,
    (portable) => separatorRewrite(scan, argument, call, portable),
    !backslash
  )
}

/**
 * The rewrite of an argument with `/` replaced by `sep` or `posix.sep`.
 *
 * @param scan - The file's checks
 * @param node - The literal, template or chain
 * @param at - Where the separator is named
 * @param portable - Whether the portable flavour is wanted
 * @returns The rewrite, or null when the argument is a regex or the separator cannot be named
 */
function separatorRewrite(scan: Scan, node: Node, at: Node, portable: boolean): Rewrite | null {
  if (node.regex !== undefined) return null
  const naming = scan.namer('path', [portable ? 'posix' : 'sep'], at)
  if (naming === null) return null
  const edits = slashEdits(scan, node, `${naming.texts[0] as string}${portable ? '.sep' : ''}`)
  return { replacement: (edits[0] as Fix).text, edits: [...naming.edits, ...edits] }
}

/**
 * Whether a built string sits inside a larger one: within a template or a `+` chain, through
 * conditionals and fallbacks.
 *
 * @param node - The template or chain
 * @returns Whether it does
 */
function isNested(node: Node): boolean {
  let parent = node.parent as Node
  while ((parent.kind === 'ConditionalExpression' && parent.test !== node) || parent.kind === 'LogicalExpression') {
    node = parent
    parent = parent.parent as Node
  }
  return (
    parent.kind === 'TemplateLiteral' ||
    parent.kind === 'TaggedTemplateExpression' ||
    (parent.kind === 'BinaryExpression' && parent.operator === '+')
  )
}

/**
 * The name a built string is stored under: a declared variable, a property, or an assignment target.
 *
 * @param node - The template or chain
 * @returns The name, or null
 */
function storedName(node: Node): string | null {
  const parent = node.parent as Node
  if (parent.kind === 'VariableDeclarator' && parent.init === node) return nameOf(parent.id as Node)
  if (parent.kind === 'AssignmentExpression' && parent.right === node) return nameOf(parent.left as Node)
  return parent.kind === 'Property' && parent.value === node && parent.computed !== true ? nameOf(parent.key as Node) : null
}

/**
 * The pieces of a built string with neighbouring text merged.
 *
 * @param node - The template or chain
 * @returns The pieces
 */
function mergedParts(node: Node): Part[] {
  const merged: Part[] = []
  for (const part of partsOf(node)) {
    const last = merged[merged.length - 1]
    if (part.text !== null && last?.text != null) merged[merged.length - 1] = { text: last.text + part.text, node: last.node }
    else merged.push(part)
  }
  return merged.filter((part) => part.text !== '')
}

/**
 * Whether a list is built from a `relative()` result, through method calls and variables.
 *
 * @param scan - The file's checks
 * @param node - The list
 * @param hops - The variables followed so far
 * @returns Whether it is
 */
function fromRelative(scan: Scan, node: Node, hops = 0): boolean {
  const target = unwrap(node)
  if (scan.tracer.originOf(target).domain === 'relative') return true
  if (target.kind === 'CallExpression') {
    const method = methodOf(target)
    return method !== null && fromRelative(scan, method.member.object as Node, hops)
  }
  const variable = target.kind === 'Identifier' ? scan.tracer.variableOf(target) : null
  const value = variable === null ? null : scan.tracer.valueOf(variable)
  return value !== null && hops < MAX_HOPS && fromRelative(scan, value, hops + 1)
}

/**
 * Whether an argument is a separator: `'/'`, `sep` or `posix.sep`.
 *
 * @param scan - The file's checks
 * @param node - The argument, or undefined
 * @returns Whether it is
 */
function isSeparator(scan: Scan, node: Node | undefined): boolean {
  if (node === undefined) return false
  const qualified = scan.tracer.qualify(node)
  return stringOf(node) === '/' || isQualified(qualified, 'path:sep') || isQualified(qualified, 'path/posix:sep')
}

/**
 * Checks a built string: `'/'` before a joined list, or `/` written next to a native value.
 *
 * @param scan - The file's checks
 * @param node - The template or `+` chain
 */
export function checkBuiltString(scan: Scan, node: Node): void {
  if (isNested(node)) return
  const call = node.parent as Node
  if (
    call.kind === 'CallExpression' &&
    (call.arguments as readonly Node[])[0] === node &&
    SEPARATOR_METHODS.has(methodOf(call)?.name as string)
  )
    return
  const parts = mergedParts(node)
  const first = parts[0]
  const second = parts[1] === undefined ? null : unwrap((parts[1] as Part).node)
  if (first?.text === '/' && second?.kind === 'CallExpression' && methodOf(second)?.name === 'join') {
    const list = (methodOf(second) as MethodCall).member.object as Node
    if (scan.node && isSeparator(scan, (second.arguments as readonly Node[])[0]) && !fromRelative(scan, list))
      scan.report(node, MESSAGES.driveLetterLoss)
    return
  }
  const text = first?.text ?? ''
  if (text.startsWith('./') || text.startsWith('../') || text.startsWith('/')) return
  if (parts.some((part) => (part.text === null ? isUrlName(nameOf(part.node)) : NOT_A_PATH.test(part.text))) || isUrlName(storedName(node)))
    return
  const adjacent = parts.filter(
    (part, index) =>
      part.text === null && (parts[index - 1]?.text?.endsWith('/') === true || parts[index + 1]?.text?.startsWith('/') === true)
  )
  if (adjacent.length === 0) return
  const origin = combine(adjacent.map((part) => scan.tracer.originOf(part.node)))
  reportTiered(scan, node, MESSAGES.separatorJoin, origin, (portable) => joinRewrite(scan, node, parts, portable))
}

/**
 * The rewrite of a built string as a `join()` call, or with `sep` in place of `/` when an empty
 * segment rules `join()` out.
 *
 * @param scan - The file's checks
 * @param node - The template or chain
 * @param parts - Its merged pieces
 * @param portable - Whether the portable flavour is wanted
 * @returns The rewrite, or null when a name cannot be referenced
 */
function joinRewrite(scan: Scan, node: Node, parts: readonly Part[], portable: boolean): Rewrite | null {
  const segments: (string | Node)[][] = [[]]
  for (const part of parts) {
    if (part.text === null) (segments[segments.length - 1] as (string | Node)[]).push(part.node)
    else
      part.text.split('/').forEach((piece, index) => {
        if (index > 0) segments.push([])
        if (piece !== '') (segments[segments.length - 1] as (string | Node)[]).push(piece)
      })
  }
  if (segments.some((segment) => segment.length === 0)) return separatorRewrite(scan, node, node, portable)
  const accept = (variable: Parameters<NonNullable<Parameters<Scan['namer']>[3]>>[0]): boolean => {
    const binding = scan.tracer.bindingOf(variable)
    return binding !== null && (isQualified(binding, 'path:join') || scan.tracer.helperDomain(binding) === 'native')
  }
  const naming = scan.namer('path', [portable ? 'posix' : 'join'], node, portable ? undefined : accept)
  if (naming === null) return null
  const source = (piece: Node): string => scan.text.slice(piece.start, piece.end)
  const rendered = segments.map((segment) => {
    const only = segment[0] as string | Node
    if (segment.length === 1 && typeof only !== 'string') return argumentText(scan.text, only)
    if (segment.every((piece) => typeof piece === 'string')) return quote(segment.join(''))
    return `\`${segment.map((piece) => (typeof piece === 'string' ? templateText(piece) : `\${${source(piece)}}`)).join('')}\``
  })
  const replacement = `${naming.texts[0] as string}${portable ? '.join' : ''}(${rendered.join(', ')})`
  return { replacement, edits: [...naming.edits, { start: node.start, end: node.end, text: replacement }] }
}

/**
 * Whether a `relative()` result leaves as data from where it is used: returned, stored, compared
 * with anything but a string without `/`, or prefixed as a specifier, directly or through
 * variables.
 *
 * @param scan - The file's checks
 * @param node - The result, or a variable read holding it
 * @param hops - The variables followed so far
 * @returns Whether it does
 */
function escapes(scan: Scan, node: Node, hops: number): boolean {
  let child = node
  let parent = child.parent as Node
  while (
    PASSING.has(parent.kind) ||
    (parent.kind === 'ConditionalExpression' && parent.test !== child) ||
    (parent.kind === 'LogicalExpression' && parent.operator !== '&&')
  ) {
    child = parent
    parent = parent.parent as Node
  }
  switch (parent.kind) {
    case 'ReturnStatement':
    case 'ArrayExpression':
      return true
    case 'ArrowFunctionExpression':
      return parent.body === child
    case 'Property':
      return parent.value === child && (parent.parent as Node).kind === 'ObjectExpression'
    case 'AssignmentExpression':
      return parent.right === child && (parent.left as Node).kind === 'MemberExpression'
    case 'CallExpression':
      return parent.callee !== child && STORING_METHODS.has(methodOf(parent)?.name as string)
    case 'BinaryExpression': {
      const other = stringOf(parent.left === child ? parent.right : parent.left)
      return (parent.operator === '===' || parent.operator === '!==') && (other === null || other.includes('/'))
    }
    case 'TemplateLiteral': {
      const before = ((parent.quasis as readonly Node[])[(parent.expressions as readonly Node[]).indexOf(child)] as Node)
        .value as TemplateValue
      return /(^|\.\.?)\/$/.test(before.cooked ?? '')
    }
    case 'VariableDeclarator': {
      const variable =
        parent.id === undefined || (parent.id as Node).kind !== 'Identifier' ? null : scan.tracer.variableOf(parent.id as Node)
      if (variable === null || hops >= MAX_HOPS) return false
      return variable.references.some((reference) => reference.isRead() && escapes(scan, reference.identifier, hops + 1))
    }
    default:
      return false
  }
}

/**
 * Checks a call of `relative()` from node:path whose result leaves as data.
 *
 * @param scan - The file's checks
 * @param call - Any call
 */
export function checkRelative(scan: Scan, call: Node): void {
  if (!isQualified(scan.tracer.qualify(call.callee as Node), 'path:relative') || !escapes(scan, call, 0)) return
  const naming = scan.namer('path', ['sep', 'posix'], call)
  const fix =
    naming === null
      ? null
      : mergeEdits(scan.text, [
          ...naming.edits,
          { start: call.end, end: call.end, text: `.split(${naming.texts[0] as string}).join(${naming.texts[1] as string}.sep)` },
        ])
  scan.report(call, MESSAGES.relativeEscapes, fix)
}
