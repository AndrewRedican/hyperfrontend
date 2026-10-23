/**
 * How the convention rules read a module source: which category it falls in (Node built-in,
 * external, internal scope, relative, current directory), how deep a relative one climbs, and the
 * order the ordering rules put sources and type-only statements in.
 *
 * @module rules/conventions/shared/sources
 */

import type { Node } from '../../../code/model'
import { builtinModules } from 'node:module'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** Where a module source points. */
export type SourceCategory = 'node' | 'external' | 'internal' | 'relative' | 'current'

/** The categories in the order the rules want them. */
const ORDER: readonly SourceCategory[] = ['node', 'external', 'internal', 'relative', 'current']

/** The modules Node ships, as this runtime lists them. */
const BUILTINS = createSet<string>(builtinModules)

/**
 * Whether a bare source names a Node built-in module, by its first path segment.
 *
 * @param source - The source as written, such as `fs/promises`
 * @returns True when Node ships it without the `node:` prefix
 *
 * @example Recognise an unprefixed built-in by its first segment
 * ```ts
 * isBuiltinModule('fs/promises') // => true
 * isBuiltinModule('lodash') // => false
 * isBuiltinModule('node:fs') // => false (the prefixed form is checked separately)
 * ```
 */
export function isBuiltinModule(source: string): boolean {
  return BUILTINS.has(source.split('/')[0] as string)
}

/**
 * Which category a source falls in.
 *
 * @param source - The source as written
 * @param internalScopes - Package scopes, such as `@acme`, whose packages form their own group after the external ones
 * @returns `node` for a built-in, `current` for `./`, `relative` for `../`, `internal` for a package in one of the internal scopes, `external` otherwise
 *
 * @example Categorise sources with an internal scope
 * ```ts
 * sourceCategory('fs') // => 'node'
 * sourceCategory('@acme/ui', ['@acme']) // => 'internal'
 * sourceCategory('@acme/ui') // => 'external'
 * sourceCategory('../../core') // => 'relative'
 * ```
 */
export function sourceCategory(source: string, internalScopes: readonly string[] = []): SourceCategory {
  if (source.startsWith('node:') || isBuiltinModule(source)) return 'node'
  if (source.startsWith('./')) return 'current'
  if (source.startsWith('../')) return 'relative'
  if (internalScopes.some((scope) => source.startsWith(`${scope}/`))) return 'internal'
  return 'external'
}

/**
 * How many directories a relative source climbs.
 *
 * @param source - The source as written
 * @returns The count of leading `../` segments
 *
 * @example Count only the leading parent segments
 * ```ts
 * relativeDepth('../../core/model') // => 2
 * relativeDepth('../x/../y') // => 1
 * relativeDepth('./util') // => 0
 * ```
 */
export function relativeDepth(source: string): number {
  let depth = 0
  while (source.startsWith('../', depth * 3)) depth += 1
  return depth
}

/**
 * Orders two sources: by category, deeper relative sources first, then alphabetically.
 *
 * @param a - One source
 * @param b - Another
 * @param internalScopes - The package scopes grouped after the external packages
 * @returns Negative when `a` comes first
 *
 * @example Sort sources the way the ordering rules expect
 * ```ts
 * const sources = ['./util', '../core', '../../shared', 'react', 'node:fs', '@acme/ui']
 * sources.sort((a, b) => compareSources(a, b, ['@acme']))
 * // => ['node:fs', 'react', '@acme/ui', '../../shared', '../core', './util']
 * ```
 */
export function compareSources(a: string, b: string, internalScopes: readonly string[] = []): number {
  const categoryA = sourceCategory(a, internalScopes)
  const categoryB = sourceCategory(b, internalScopes)
  if (categoryA !== categoryB) return ORDER.indexOf(categoryA) - ORDER.indexOf(categoryB)
  if (categoryA === 'relative' && relativeDepth(a) !== relativeDepth(b)) return relativeDepth(b) - relativeDepth(a)
  return a.localeCompare(b)
}

/**
 * The source an import or re-export names.
 *
 * @param node - An import declaration or an export with a source
 * @returns The module specifier
 *
 * @example Read the specifier of an import or a re-export
 * ```ts
 * // program: import fs from 'node:fs' / export { run } from '../run'
 * program.body.map(sourceOf) // => ['node:fs', '../run']
 * ```
 */
export function sourceOf(node: Node): string {
  return (node.source as Node).value as string
}

/**
 * Whether an import or export is type-only.
 *
 * @param node - The declaration
 * @returns True for `import type` and `export type`
 *
 * @example Spot type-only imports and exports
 * ```ts
 * // program: import type { Config } from './config'
 * //          import fs from 'node:fs'
 * //          export type { Plan } from './plan'
 * program.body.map(isTypeOnly) // => [true, false, true]
 * ```
 */
export function isTypeOnly(node: Node): boolean {
  return node.importKind === 'type' || node.exportKind === 'type'
}

/**
 * Orders two import or re-export statements: type-only ones first, then by source.
 *
 * @param a - One statement
 * @param b - Another
 * @param internalScopes - The package scopes grouped after the external packages
 * @returns Negative when `a` comes first
 *
 * @example Type-only statements sort ahead of value statements
 * ```ts
 * // program: export { run } from '../run'
 * //          import fs from 'node:fs'
 * //          import type { Config } from './config'
 * const sorted = [...program.body].sort((a, b) => compareModuleStatements(a, b))
 * sorted.map(sourceOf) // => ['./config', 'node:fs', '../run']
 * ```
 */
export function compareModuleStatements(a: Node, b: Node, internalScopes: readonly string[] = []): number {
  const typeA = isTypeOnly(a)
  const typeB = isTypeOnly(b)
  if (typeA !== typeB) return typeA ? -1 : 1
  return compareSources(sourceOf(a), sourceOf(b), internalScopes)
}
