import type { EntryPoint, FormatEntryConfig } from '../../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { matchGlobPattern } from '@hyperfrontend/project-scope/core'

const normalizePattern = (pattern: string): string => {
  if (pattern === '.') return pattern
  if (pattern.startsWith('./')) return pattern
  return `./${pattern}`
}

const matchesPattern = (entry: EntryPoint, pattern: string): boolean => {
  const normalized = normalizePattern(pattern)
  if (normalized === entry.exportPath) return true
  if (normalized.includes('*')) return matchGlobPattern(entry.exportPath, normalized)
  return false
}

const toPatternList = (patterns: string | string[]): string[] => (isArray(patterns) ? (patterns as string[]) : [patterns as string])

/**
 * Filters discovered entry points using a `FormatEntryConfig`'s
 * `entry` and `exclude` patterns.
 *
 * Patterns may be exact subpaths (`./browser`), globs (`./browser/*`), or arrays of either.
 * When `entry` is omitted every discovered entry is considered, then `exclude` removes matches.
 *
 * @param config - Format-level entry configuration.
 * @param discoveredEntries - Entry points returned by `discoverEntries`.
 * @returns Filtered entry points in their original order.
 *
 * @example Selecting only browser entries
 * ```typescript
 * resolveEntries({ entry: './browser/*' }, discovery.entryPoints)
 * ```
 */
export const resolveEntries = (config: FormatEntryConfig, discoveredEntries: EntryPoint[]): EntryPoint[] => {
  let entries = discoveredEntries
  if (config.entry !== undefined) {
    const patterns = toPatternList(config.entry)
    entries = entries.filter((entry) => patterns.some((pattern) => matchesPattern(entry, pattern)))
  }
  if (config.exclude !== undefined) {
    const patterns = toPatternList(config.exclude)
    entries = entries.filter((entry) => !patterns.some((pattern) => matchesPattern(entry, pattern)))
  }
  return entries
}
