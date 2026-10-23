/**
 * How the workspace rules read a module source: which category it falls in (Node built-in,
 * external, workspace, relative, current directory), how deep a relative one climbs, and the
 * order the ordering rules put sources and type-only statements in.
 *
 * @module rules/workspace/shared/sources
 */

import type { Node } from '@hyperfrontend/linter'
import { builtinModules } from 'node:module'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** Where a module source points. */
export type SourceCategory = 'node' | 'external' | 'workspace' | 'relative' | 'current'

/** The categories in the order the rules want them. */
const ORDER: readonly SourceCategory[] = ['node', 'external', 'workspace', 'relative', 'current']

/** The modules Node ships, as this runtime lists them. */
const BUILTINS = createSet<string>(builtinModules)

/**
 * Whether a bare source names a Node built-in module, by its first path segment.
 *
 * @param source - The source as written, such as `fs/promises`
 * @returns True when Node ships it without the `node:` prefix
 */
export function isBuiltinModule(source: string): boolean {
  return BUILTINS.has(source.split('/')[0] as string)
}

/**
 * Which category a source falls in.
 *
 * @param source - The source as written
 * @returns `node` for a built-in, `current` for `./`, `relative` for `../`, `workspace` for the `@hyperfrontend` scope, `external` otherwise
 */
export function sourceCategory(source: string): SourceCategory {
  if (source.startsWith('node:') || isBuiltinModule(source)) return 'node'
  if (source.startsWith('./')) return 'current'
  if (source.startsWith('../')) return 'relative'
  if (source.startsWith('@hyperfrontend/')) return 'workspace'
  return 'external'
}

/**
 * How many directories a relative source climbs.
 *
 * @param source - The source as written
 * @returns The count of leading `../` segments
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
 * @returns Negative when `a` comes first
 */
export function compareSources(a: string, b: string): number {
  const categoryA = sourceCategory(a)
  const categoryB = sourceCategory(b)
  if (categoryA !== categoryB) return ORDER.indexOf(categoryA) - ORDER.indexOf(categoryB)
  if (categoryA === 'relative' && relativeDepth(a) !== relativeDepth(b)) return relativeDepth(b) - relativeDepth(a)
  return a.localeCompare(b)
}

/**
 * The source an import or re-export names.
 *
 * @param node - An import declaration or an export with a source
 * @returns The module specifier
 */
export function sourceOf(node: Node): string {
  return (node.source as Node).value as string
}

/**
 * Whether an import or export is type-only.
 *
 * @param node - The declaration
 * @returns True for `import type` and `export type`
 */
export function isTypeOnly(node: Node): boolean {
  return node.importKind === 'type' || node.exportKind === 'type'
}

/**
 * Orders two import or re-export statements: type-only ones first, then by source.
 *
 * @param a - One statement
 * @param b - Another
 * @returns Negative when `a` comes first
 */
export function compareModuleStatements(a: Node, b: Node): number {
  const typeA = isTypeOnly(a)
  const typeB = isTypeOnly(b)
  if (typeA !== typeB) return typeA ? -1 : 1
  return compareSources(sourceOf(a), sourceOf(b))
}
