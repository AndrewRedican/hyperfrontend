/**
 * Modules the configuration names, by gitignore-style patterns, are not imported, or only
 * without the names the pattern restricts, or only with the names it allows.
 *
 * @module rules/javascript/no-restricted-imports
 */

import type { Node, SourceToken } from '../../code/model'
import type { RuleContext } from '../../engine/rule'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { tokenAfter } from '../../code/source'
import { defineRule } from '../../engine/rule'

/** One restriction. */
export interface RestrictedPattern {
  /** The gitignore-style patterns a module path is matched against, a `!` prefix excepting a path. */
  readonly group: readonly string[]
  /** The names that may not be imported from a matching module; every name when absent. */
  readonly importNames?: readonly string[]
  /** The only names that may be imported from a matching module. */
  readonly allowImportNames?: readonly string[]
  /** Text appended to the report. */
  readonly message?: string
}

/** The rule's options. */
export interface NoRestrictedImportsOptions {
  /** The restrictions. */
  readonly patterns?: readonly RestrictedPattern[]
}

/** What the helpers read of the rule's context. */
type Context = RuleContext<NoRestrictedImportsOptions | undefined, Node>

/** A span to report on. */
interface Span {
  /** The offset of its first character. */
  readonly start: number
  /** The offset after its last character. */
  readonly end: number
}

export default defineRule<NoRestrictedImportsOptions | undefined, Node>({
  id: 'no-restricted-imports',
  language: 'code',
  fixable: false,
  create(context) {
    const patterns = context.options?.patterns ?? []
    const check = (node: Node, source: Node, names: ReadonlyMap<string, readonly Span[]>): void => {
      const path = (source.value as string).trim()
      for (const pattern of patterns) {
        if (matchesGroup(pattern.group, path)) report(context, node, path, names, pattern)
      }
    }
    return {
      ImportDeclaration(node) {
        check(node, node.source as Node, specifierNames(node.specifiers as readonly Node[]))
      },
      ExportNamedDeclaration(node) {
        const source = node.source as Node | null
        if (source !== null) check(node, source, specifierNames(node.specifiers as readonly Node[]))
      },
      ExportAllDeclaration(node) {
        // how: the `*` is the declaration's second token, after `export`.
        const star = tokenAfter(context.tree, (tokenAfter(context.tree, node.start) as SourceToken).end) as SourceToken
        check(node, node.source as Node, createMap<string, readonly Span[]>([['*', [star]]]))
      },
      TSImportEqualsDeclaration(node) {
        const reference = node.moduleReference as Node
        if (reference.kind !== 'TSExternalModuleReference') return
        check(node, reference.expression as Node, createMap<string, readonly Span[]>())
      },
    }
  },
})

/**
 * The names an import or re-export brings in, each with the specifiers naming it: `default`
 * for a default import, `*` for a namespace, otherwise the name as the module exports it.
 *
 * @param specifiers - The declaration's specifiers
 * @returns The specifiers by name
 */
function specifierNames(specifiers: readonly Node[]): ReadonlyMap<string, readonly Span[]> {
  const names = createMap<string, Span[]>()
  for (const specifier of specifiers) {
    const name = exportedName(specifier)
    const spans = names.get(name)
    if (spans === undefined) names.set(name, [specifier])
    else spans.push(specifier)
  }
  return names
}

/**
 * The name under which a specifier's module exports what it imports.
 *
 * @param specifier - An import or export specifier
 * @returns That name
 */
function exportedName(specifier: Node): string {
  if (specifier.kind === 'ImportDefaultSpecifier') return 'default'
  if (specifier.kind === 'ImportNamespaceSpecifier') return '*'
  const named = (specifier.kind === 'ImportSpecifier' ? specifier.imported : specifier.local) as Node
  return named.kind === 'Identifier' ? (named.name as string) : (named.value as string)
}

/**
 * Reports what one matching restriction forbids in a declaration.
 *
 * @param context - The rule's context
 * @param node - The declaration
 * @param path - The module path as written
 * @param names - The names imported, with the specifiers naming them
 * @param pattern - The restriction that matched
 */
function report(context: Context, node: Node, path: string, names: ReadonlyMap<string, readonly Span[]>, pattern: RestrictedPattern): void {
  const suffix = pattern.message === undefined ? '' : ` ${pattern.message}`
  const restricted = pattern.importNames
  const allowed = pattern.allowImportNames
  if (restricted === undefined && allowed === undefined) {
    context.report({ start: node.start, end: node.end, message: `'${path}' import is restricted from being used by a pattern.${suffix}` })
    return
  }
  for (const [name, spans] of names) {
    if (name === '*') {
      const star = spans[0] as Span
      const message =
        restricted === undefined
          ? `* import is invalid because only '${(allowed as readonly string[]).join(',')}' from '${path}' is/are allowed.`
          : `* import is invalid because '${restricted.join(',')}' from '${path}' is restricted from being used by a pattern.`
      context.report({ start: star.start, end: star.end, message: message + suffix })
      continue
    }
    if (restricted?.includes(name) === true) {
      for (const span of spans) {
        context.report({
          start: span.start,
          end: span.end,
          message: `'${name}' import from '${path}' is restricted from being used by a pattern.${suffix}`,
        })
      }
    }
    if (allowed !== undefined && !allowed.includes(name)) {
      for (const span of spans) {
        context.report({
          start: span.start,
          end: span.end,
          message: `'${name}' import from '${path}' is restricted because only '${allowed.join(',')}' import(s) is/are allowed.${suffix}`,
        })
      }
    }
  }
}

/**
 * Whether a module path falls under a group of gitignore-style patterns: the last pattern that
 * matches decides, and a `!` prefix makes a match except the path.
 *
 * @param group - The patterns, in order
 * @param path - The module path
 * @returns Whether the path is restricted
 */
function matchesGroup(group: readonly string[], path: string): boolean {
  const segments = segmentsOf(path.toLowerCase())
  let matched = false
  for (const pattern of group) {
    const negated = pattern.startsWith('!')
    if (matchesPattern(negated ? pattern.slice(1) : pattern, segments)) matched = !negated
  }
  return matched
}

/**
 * Whether one gitignore-style pattern matches a path: a pattern with a slash inside it matches
 * from the path's start, one without, or one starting with `**\/`, matches from any segment;
 * `**` stands for any segments, `*` and `?` for characters within a segment, and the match
 * covers the segments after it, as a matched directory covers its content. Letter case is ignored.
 *
 * @param pattern - The pattern without its `!`
 * @param segments - The path's segments, in lower case
 * @returns Whether the pattern matches
 */
function matchesPattern(pattern: string, segments: readonly string[]): boolean {
  let text = pattern.toLowerCase()
  let anywhere = true
  if (text.startsWith('**/')) text = text.slice(3)
  else if (text.startsWith('/')) {
    text = text.slice(1)
    anywhere = false
  } else if (text.includes('/')) {
    anywhere = false
  }
  const parts = segmentsOf(text)
  if (!anywhere) return matchesFrom(parts, 0, segments, 0)
  for (let index = 0; index < segments.length; index += 1) if (matchesFrom(parts, 0, segments, index)) return true
  return false
}

/**
 * The pieces of a module path or pattern between its slashes.
 *
 * @param text - A module path or a pattern, which `/` separates whatever the platform
 * @returns The pieces, in order, empty ones included
 */
function segmentsOf(text: string): string[] {
  // why: a module specifier is no native path; `/` separates it on every platform.
  const pieces: string[] = []
  let from = 0
  for (let slash = text.indexOf('/'); slash !== -1; slash = text.indexOf('/', from)) {
    pieces.push(text.slice(from, slash))
    from = slash + 1
  }
  pieces.push(text.slice(from))
  return pieces
}

/**
 * Whether the pattern's pieces from one index on match the path's pieces from another.
 *
 * @param parts - The pattern split at its slashes
 * @param part - The index of the first pattern piece matched
 * @param segments - The path split at its slashes
 * @param segment - The index of the first path piece matched
 * @returns Whether every remaining pattern segment matches
 */
function matchesFrom(parts: readonly string[], part: number, segments: readonly string[], segment: number): boolean {
  if (part === parts.length) return true
  if (parts[part] === '**') {
    for (let skip = segment; skip <= segments.length; skip += 1) if (matchesFrom(parts, part + 1, segments, skip)) return true
    return false
  }
  if (segment === segments.length || !matchesSegment(parts[part] as string, 0, segments[segment] as string, 0)) return false
  return matchesFrom(parts, part + 1, segments, segment + 1)
}

/**
 * Whether a segment pattern matches a segment from given positions on: `*` stands for any
 * characters, `?` for one, anything else for itself.
 *
 * @param pattern - The pattern for one piece of the path
 * @param at - The position in the pattern
 * @param segment - The piece of the path matched
 * @param from - The position in the piece
 * @returns Whether the rest of the pattern matches the rest of the segment
 */
function matchesSegment(pattern: string, at: number, segment: string, from: number): boolean {
  if (at === pattern.length) return from === segment.length
  const character = pattern[at] as string
  if (character === '*') {
    for (let skip = from; skip <= segment.length; skip += 1) if (matchesSegment(pattern, at + 1, segment, skip)) return true
    return false
  }
  if (from === segment.length || (character !== '?' && character !== segment[from])) return false
  return matchesSegment(pattern, at + 1, segment, from + 1)
}
