/**
 * What a change to `tsconfig.base.json` comes to: nothing a task can be told apart by when it
 * touches a compiler option, and otherwise the path aliases that differ, with the files importing
 * through them. A task is then selected only where it reads such a file.
 *
 * The comparison follows what an alias does to an import. A tool that reads the alias table as a
 * whole, such as a lint rule comparing the entries of a package, is outside it: its target names
 * the file among its inputs, and is then selected by any change to it.
 *
 * @module graph/affected/aliases
 */

import type { WorkspaceGraph } from '../build'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compareText } from '../order'
import { wildcardCapture } from '../resolve'

/** The file holding the path aliases, whose change is judged alias by alias when its previous content is at hand. */
export const BASE_TSCONFIG = 'tsconfig.base.json'

/** The compiler options of a base tsconfig, of which the selection reads the aliases apart from the rest. */
export interface BaseCompilerOptions {
  /** The path aliases, each to its targets. */
  readonly paths?: Readonly<Record<string, unknown>>
  /** Every other option, compared as written. */
  readonly [option: string]: unknown
}

/** A `tsconfig.base.json`, as far as the selection reads it. */
export interface BaseTsconfig {
  /** The compiler options. */
  readonly compilerOptions?: BaseCompilerOptions
  /** Every other field, compared as written. */
  readonly [field: string]: unknown
}

/** An import a changed alias resolves. */
export interface AliasedImport {
  /** The alias that changed. */
  readonly alias: string
  /** The specifier the file imports. */
  readonly specifier: string
}

/**
 * A base tsconfig without its path aliases, as one comparable text.
 *
 * @param config - The base tsconfig
 * @returns Everything the file says besides its aliases
 */
function withoutAliases(config: BaseTsconfig): string {
  // why: a key holding undefined is left out of the text, so the aliases drop out and every other option stays
  return stringify({ ...config, compilerOptions: { ...config.compilerOptions, paths: undefined } })
}

/**
 * The path aliases that differ between two contents of the base tsconfig.
 *
 * @param previous - The file at the base of the change
 * @param current - The file at the head
 * @returns The aliases added, removed or pointed elsewhere, sorted, or null when the two differ outside their `paths`
 *
 * @example An added alias is named; a changed compiler option is not a change of aliases
 * ```typescript
 * const before = { compilerOptions: { strict: true, paths: { '@acme/data': ['libs/data/src/index.ts'] } } }
 * const entry = { '@acme/data/csv': ['libs/data/src/csv/index.ts'] }
 * changedAliases(before, { compilerOptions: { strict: true, paths: { ...before.compilerOptions.paths, ...entry } } })
 * // => ['@acme/data/csv']
 * changedAliases(before, { compilerOptions: { ...before.compilerOptions, strict: false } }) // => null
 * ```
 */
export function changedAliases(previous: BaseTsconfig, current: BaseTsconfig): readonly string[] | null {
  if (withoutAliases(previous) !== withoutAliases(current)) return null
  const before = previous.compilerOptions?.paths ?? {}
  const after = current.compilerOptions?.paths ?? {}
  return [...createSet([...keys(before), ...keys(after)])]
    .filter((alias) => stringify(before[alias]) !== stringify(after[alias]))
    .sort(compareText)
}

/**
 * The changed alias that resolves a specifier, exactly or through its wildcard.
 *
 * @param aliases - The aliases that changed
 * @param specifier - The specifier a file imports
 * @returns The first such alias, or null when none resolves the specifier
 *
 * @example An alias resolves its own specifier, a wildcard alias every specifier it matches
 * ```typescript
 * aliasResolving(['@acme/data/csv'], '@acme/data/csv') // => '@acme/data/csv'
 * aliasResolving(['@acme/data/csv'], '@acme/data') // => null
 * aliasResolving(['@acme/data/*'], '@acme/data/json') // => '@acme/data/*'
 * ```
 */
export function aliasResolving(aliases: readonly string[], specifier: string): string | null {
  return aliases.find((alias) => alias === specifier || wildcardCapture(alias, specifier) !== null) ?? null
}

/** The prefix of the id of an installed package, which an import resolved without an alias names. */
const EXTERNAL = 'external:'

/**
 * The files importing through a set of changed aliases, each with the first such import. An
 * import that resolved to an installed package is not one: its file belongs to a project that
 * takes the package from a registry, which the aliases do not reach.
 *
 * @param graph - The graph at the head of the change
 * @param aliases - The aliases that changed
 * @returns The import by importing file, the files sorted
 *
 * @example Only the importers of the changed entry
 * ```typescript
 * aliasImporters(graph, ['@acme/data/csv'])
 * // => Map { 'tools/seed/src/load.ts' => { alias: '@acme/data/csv', specifier: '@acme/data/csv' } }
 * // libs/report/src/index.ts imports '@acme/data', which resolves as before
 * ```
 */
export function aliasImporters(graph: WorkspaceGraph, aliases: readonly string[]): Map<string, AliasedImport> {
  const importers = createMap<string, AliasedImport>()
  const resolving = createMap<string, string | null>()
  for (const edge of graph.records) {
    if (edge.evidence.kind !== 'source' || edge.path === null || edge.target.startsWith(EXTERNAL) || importers.has(edge.evidence.file))
      continue
    const { specifier } = edge.path
    if (!resolving.has(specifier)) resolving.set(specifier, aliasResolving(aliases, specifier))
    const alias = resolving.get(specifier) as string | null
    if (alias !== null) importers.set(edge.evidence.file, { alias, specifier })
  }
  return createMap([...importers].sort(([left], [right]) => compareText(left, right)))
}
