import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

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
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.cts', '/index.ts', '/index.tsx', '.js']

/**
 * Reads the workspace path aliases and pre-splits them into exact and wildcard forms.
 *
 * @param workspaceRoot - Absolute path to the workspace root holding `tsconfig.base.json`.
 * @returns The alias table used by `resolveAlias`.
 */
export function loadAliases(workspaceRoot: string): AliasTable {
  const declared = JSON.parse(readFileSync(resolve(workspaceRoot, 'tsconfig.base.json'), 'utf8')).compilerOptions?.paths ?? {}

  const exact = new Map<string, string[]>()
  const wildcards: AliasPattern[] = []

  for (const [pattern, targets] of Object.entries(declared) as [string, string[]][]) {
    if (pattern.includes('*')) wildcards.push({ prefix: pattern.slice(0, pattern.indexOf('*')), targets })
    else exact.set(pattern, targets)
  }

  // why: longest prefix must win, so `@hyperfrontend/builder/bundle/*` beats `@hyperfrontend/builder/*`.
  wildcards.sort((a, b) => b.prefix.length - a.prefix.length)

  return { exact, wildcards }
}

/**
 * Resolves a base path to the first candidate file that exists on disk.
 *
 * @param base - Absolute path without an extension, or with one already applied.
 * @returns The existing file path, or null when no candidate matches.
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
      const hit = firstExistingFile(resolve(workspaceRoot, target.replace('*', tail)))
      if (hit) return hit
    }
  }

  return null
}
