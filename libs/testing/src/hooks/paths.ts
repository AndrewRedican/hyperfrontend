import { readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'

/**
 * A `tsconfig.base.json` path alias with its wildcard prefix pre-computed.
 */
export type AliasPattern = {
  /** The literal portion of the alias, before any `*`. */
  prefix: string
  /** Workspace-relative target templates, in declaration order. */
  targets: string[]
}

/**
 * The workspace path aliases, split by match kind so lookup never rescans the whole table.
 */
export type AliasTable = {
  /** Aliases without a wildcard, keyed by the exact specifier they match. */
  exact: Map<string, string[]>
  /** Wildcard aliases, ordered longest prefix first. */
  wildcards: AliasPattern[]
}

/**
 * Extensions tried, in order, when a specifier carries none. The empty entry lets an
 * already-complete path through untouched; `.js` comes last so a compiled sibling never
 * wins over the TypeScript source the runner is meant to execute.
 */
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.cts', `${sep}index.ts`, `${sep}index.tsx`, '.js']

/**
 * Pre-splits declared path aliases into exact and wildcard forms.
 *
 * @param declared - Alias patterns mapped to their target templates, `paths`-style.
 * @returns The alias table used by `resolveAlias`.
 * @example Splitting exact and wildcard aliases
 * ```ts
 * const table = aliasTable({ '@app/config': ['libs/config/src/index.ts'], '@app/*': ['libs/*'] })
 * table.exact.get('@app/config') // => ['libs/config/src/index.ts']
 * table.wildcards // => [{ prefix: '@app/', targets: ['libs/*'] }]
 * ```
 */
export function aliasTable(declared: Record<string, string[]>): AliasTable {
  const exact = new Map<string, string[]>()
  const wildcards: AliasPattern[] = []

  for (const [pattern, targets] of Object.entries(declared)) {
    if (pattern.includes('*')) wildcards.push({ prefix: pattern.slice(0, pattern.indexOf('*')), targets })
    else exact.set(pattern, targets)
  }

  // why: longest prefix must win, so `@hyperfrontend/builder/bundle/*` beats `@hyperfrontend/builder/*`.
  wildcards.sort((a, b) => b.prefix.length - a.prefix.length)

  return { exact, wildcards }
}

/**
 * The file path aliases are read from, where a project has one.
 */
const ALIAS_FILE = 'tsconfig.base.json'

/**
 * Reads the workspace path aliases and pre-splits them into exact and wildcard forms.
 *
 * A workspace that declares no `tsconfig.base.json` has no aliases to read, and its bare
 * specifiers are left to Node; an explicit table can still be handed to the hooks through
 * the environment.
 *
 * @param workspaceRoot - Absolute path to the workspace root that may hold `tsconfig.base.json`.
 * @returns The alias table used by `resolveAlias`.
 * @example Reading a workspace's `tsconfig.base.json` aliases
 * ```ts
 * const aliases = loadAliases('/repo') // reads compilerOptions.paths from /repo/tsconfig.base.json
 * aliases.exact.has('@app/config') // => true when the file declares that alias
 * loadAliases('/tmp/no-workspace').exact.size // => 0, a missing file means no aliases
 * ```
 */
export function loadAliases(workspaceRoot: string): AliasTable {
  const aliasFile = resolve(workspaceRoot, ALIAS_FILE)
  if (!statSync(aliasFile, { throwIfNoEntry: false })?.isFile()) return aliasTable({})
  return aliasTable(JSON.parse(readFileSync(aliasFile, 'utf8')).compilerOptions?.paths ?? {})
}

/**
 * Resolves a base path to the first candidate file that exists on disk.
 *
 * @param base - Absolute path without an extension, or with one already applied.
 * @returns The existing file path, or null when no candidate matches.
 * @example Completing an extensionless specifier
 * ```ts
 * firstExistingFile('/repo/src/config') // => '/repo/src/config.ts', or '/repo/src/config/index.ts' for a directory
 * firstExistingFile('/repo/src/config.ts') // => '/repo/src/config.ts', an extension already present is kept
 * firstExistingFile('/repo/src/absent') // => null
 * ```
 */
export function firstExistingFile(base: string): string | null {
  for (const suffix of CANDIDATE_SUFFIXES) {
    // why: a bare directory path exists but is not importable, so the empty suffix must not win over `/index.ts`.
    const candidate = base + suffix
    if (statSync(candidate, { throwIfNoEntry: false })?.isFile()) return candidate
  }
  return null
}

/**
 * Maps a bare specifier through the workspace path aliases.
 *
 * @param specifier - The specifier as written in the importing module.
 * @param aliases - The alias table produced by `loadAliases`.
 * @param workspaceRoot - Absolute path the alias targets are relative to.
 * @returns The resolved absolute file path, or null when no alias matches.
 * @example Mapping a specifier through the alias table
 * ```ts
 * const table = aliasTable({ '@app/config': ['libs/config/src/index.ts'], '@app/*': ['libs/*'] })
 * resolveAlias('@app/config', table, '/repo') // => '/repo/libs/config/src/index.ts'
 * resolveAlias('@app/auth', table, '/repo') // => '/repo/libs/auth/index.ts', when that file exists
 * resolveAlias('node:fs', table, '/repo') // => null, left to Node
 * ```
 */
export function resolveAlias(specifier: string, aliases: AliasTable, workspaceRoot: string): string | null {
  const exactTargets = aliases.exact.get(specifier)
  if (exactTargets) {
    for (const target of exactTargets) {
      const hit = firstExistingFile(resolve(workspaceRoot, target))
      if (hit) return hit
    }
    return null
  }

  for (const pattern of aliases.wildcards) {
    if (!specifier.startsWith(pattern.prefix)) continue
    const tail = specifier.slice(pattern.prefix.length)
    for (const target of pattern.targets) {
      const hit = firstExistingFile(resolve(workspaceRoot, target.replaceAll('*', tail)))
      if (hit) return hit
    }
  }

  return null
}
