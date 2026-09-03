import type { SemVer } from '../../semver/models'
import type { Changelog, ChangelogHeader, ChangelogMetadata } from '../models/changelog'
import type { ChangelogEntry, ChangelogSection, ChangelogItem } from '../models/entry'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compare } from '../../semver/compare/compare'
import { parseVersion } from '../../semver/parse/version'
import { isEntryEqual, isSectionEqual, isItemEqual } from '../compare/is-equal'

/**
 * Strategy for resolving merge conflicts.
 */
export type MergeStrategy = 'source' | 'target' | 'union' | 'latest'

/**
 * Options for merging changelogs.
 */
export interface MergeOptions {
  /** Strategy for conflicting entries (default: 'union') */
  readonly entryStrategy?: MergeStrategy

  /** Strategy for conflicting sections (default: 'union') */
  readonly sectionStrategy?: MergeStrategy

  /** Strategy for conflicting items (default: 'union') */
  readonly itemStrategy?: MergeStrategy

  /** Use source header (default: true) */
  readonly useSourceHeader?: boolean

  /** Sort entries by version after merge */
  readonly sortByVersion?: boolean

  /** Remove duplicates */
  readonly removeDuplicates?: boolean
}

/**
 * Default merge options.
 */
export const DEFAULT_MERGE_OPTIONS: Required<MergeOptions> = {
  entryStrategy: 'union',
  sectionStrategy: 'union',
  itemStrategy: 'union',
  useSourceHeader: true,
  sortByVersion: true,
  removeDuplicates: true,
}

/**
 * Result of a merge operation.
 */
export interface MergeResult {
  /** The merged changelog */
  readonly changelog: Changelog

  /** Statistics about the merge */
  readonly stats: MergeStats
}

/**
 * Statistics about a merge operation.
 */
export interface MergeStats {
  /** Number of entries in result */
  readonly totalEntries: number

  /** Entries only in source */
  readonly sourceOnly: number

  /** Entries only in target */
  readonly targetOnly: number

  /** Entries merged from both */
  readonly merged: number

  /** Number of conflicts resolved */
  readonly conflictsResolved: number
}

/**
 * Merges two changelogs together.
 *
 * @param source - The source changelog
 * @param target - The target changelog
 * @param options - Optional merge options
 * @returns The merge result with merged changelog and stats
 *
 * @example Merging two changelogs
 * ```ts
 * const result = mergeChangelogs(mainChangelog, branchChangelog)
 * console.log(`Merged ${result.stats.merged} entries`)
 * ```
 */
export function mergeChangelogs(source: Changelog, target: Changelog, options?: MergeOptions): MergeResult {
  const opts = resolveOptions(options)

  const sourceByVersion = createMap<string, ChangelogEntry>()
  const targetByVersion = createMap<string, ChangelogEntry>()

  for (const entry of source.entries) {
    sourceByVersion.set(entry.version, entry)
  }

  for (const entry of target.entries) {
    targetByVersion.set(entry.version, entry)
  }

  const mergedEntries: ChangelogEntry[] = []
  const allVersions = createSet([...sourceByVersion.keys(), ...targetByVersion.keys()])
  let sourceOnly = 0
  let targetOnly = 0
  let merged = 0
  let conflictsResolved = 0

  for (const version of allVersions) {
    const sourceEntry = sourceByVersion.get(version)
    const targetEntry = targetByVersion.get(version)

    if (sourceEntry && !targetEntry) {
      mergedEntries.push(sourceEntry)
      sourceOnly++
    } else if (!sourceEntry && targetEntry) {
      mergedEntries.push(targetEntry)
      targetOnly++
    } else if (sourceEntry && targetEntry) {
      if (isEntryEqual(sourceEntry, targetEntry)) {
        mergedEntries.push(sourceEntry)
      } else {
        const mergedEntry = mergeEntries(sourceEntry, targetEntry, opts)
        mergedEntries.push(mergedEntry)
        conflictsResolved++
      }
      merged++
    }
  }

  let finalEntries = mergedEntries
  if (opts.sortByVersion) {
    finalEntries = sortEntriesByVersion(mergedEntries)
  }

  const header: ChangelogHeader = opts.useSourceHeader ? source.header : target.header

  const metadata: ChangelogMetadata = {
    format: source.metadata.format,
    isConventional: source.metadata.isConventional || target.metadata.isConventional,
    repositoryUrl: source.metadata.repositoryUrl ?? target.metadata.repositoryUrl,
    packageName: source.metadata.packageName ?? target.metadata.packageName,
    warnings: [...source.metadata.warnings, ...target.metadata.warnings],
  }

  const changelog: Changelog = {
    header,
    entries: finalEntries,
    metadata,
  }

  return {
    changelog,
    stats: {
      totalEntries: finalEntries.length,
      sourceOnly,
      targetOnly,
      merged,
      conflictsResolved,
    },
  }
}

/**
 * Merges two changelog entries.
 *
 * @param source - Source entry
 * @param target - Target entry
 * @param opts - Resolved merge options
 * @returns Merged entry
 */
function mergeEntries(source: ChangelogEntry, target: ChangelogEntry, opts: Required<MergeOptions>): ChangelogEntry {
  const date = opts.entryStrategy === 'target' ? target.date : source.date
  const compareUrl = opts.entryStrategy === 'target' ? target.compareUrl : source.compareUrl
  const unreleased = source.unreleased || target.unreleased

  const sections = mergeSections(source.sections, target.sections, opts)

  return {
    version: source.version,
    date,
    unreleased,
    compareUrl,
    sections,
  }
}

/**
 * Merges section arrays.
 *
 * @param sourceSections - Array of sections from the source changelog
 * @param targetSections - Array of sections from the target changelog
 * @param opts - Resolved merge options
 * @returns Merged sections
 */
function mergeSections(
  sourceSections: readonly ChangelogSection[],
  targetSections: readonly ChangelogSection[],
  opts: Required<MergeOptions>
): ChangelogSection[] {
  const sourceByType = createMap<string, ChangelogSection>()
  const targetByType = createMap<string, ChangelogSection>()

  for (const section of sourceSections) {
    sourceByType.set(section.type, section)
  }

  for (const section of targetSections) {
    targetByType.set(section.type, section)
  }

  const result: ChangelogSection[] = []
  const allTypes = createSet([...sourceByType.keys(), ...targetByType.keys()])

  for (const type of allTypes) {
    const sourceSection = sourceByType.get(type)
    const targetSection = targetByType.get(type)

    if (sourceSection && !targetSection) {
      result.push(sourceSection)
    } else if (!sourceSection && targetSection) {
      result.push(targetSection)
    } else if (sourceSection && targetSection) {
      if (isSectionEqual(sourceSection, targetSection)) {
        result.push(sourceSection)
      } else {
        const mergedSection = mergeSection(sourceSection, targetSection, opts)
        result.push(mergedSection)
      }
    }
  }

  return result
}

/**
 * Merges two sections.
 *
 * @param source - Section from the source changelog
 * @param target - Section from the target changelog
 * @param opts - Resolved merge options
 * @returns Merged section
 */
function mergeSection(source: ChangelogSection, target: ChangelogSection, opts: Required<MergeOptions>): ChangelogSection {
  const heading = opts.sectionStrategy === 'target' ? target.heading : source.heading
  const items = mergeItems(source.items, target.items, opts)

  return {
    type: source.type,
    heading,
    items,
  }
}

/**
 * Merges item arrays.
 *
 * @param sourceItems - Array of items from the source section
 * @param targetItems - Array of items from the target section
 * @param opts - Resolved merge options
 * @returns Merged items
 */
function mergeItems(
  sourceItems: readonly ChangelogItem[],
  targetItems: readonly ChangelogItem[],
  opts: Required<MergeOptions>
): ChangelogItem[] {
  if (opts.itemStrategy === 'source') {
    return [...sourceItems]
  }

  if (opts.itemStrategy === 'target') {
    return [...targetItems]
  }

  const result: ChangelogItem[] = [...sourceItems]

  for (const targetItem of targetItems) {
    const exists = sourceItems.some((sourceItem) => isItemEqual(sourceItem, targetItem))

    if (!exists) {
      if (opts.itemStrategy === 'latest') {
        const existingIndex = result.findIndex((item) => item.description === targetItem.description)
        if (existingIndex !== -1) {
          result[existingIndex] = targetItem
          continue
        }
      }

      result.push(targetItem)
    }
  }

  return result
}

/**
 * Resolves merge options with defaults.
 *
 * @param options - Optional merge options to resolve with defaults
 * @returns Fully resolved merge options with all required fields
 */
function resolveOptions(options?: MergeOptions): Required<MergeOptions> {
  if (!options) {
    return DEFAULT_MERGE_OPTIONS
  }

  return {
    entryStrategy: options.entryStrategy ?? DEFAULT_MERGE_OPTIONS.entryStrategy,
    sectionStrategy: options.sectionStrategy ?? DEFAULT_MERGE_OPTIONS.sectionStrategy,
    itemStrategy: options.itemStrategy ?? DEFAULT_MERGE_OPTIONS.itemStrategy,
    useSourceHeader: options.useSourceHeader ?? DEFAULT_MERGE_OPTIONS.useSourceHeader,
    sortByVersion: options.sortByVersion ?? DEFAULT_MERGE_OPTIONS.sortByVersion,
    removeDuplicates: options.removeDuplicates ?? DEFAULT_MERGE_OPTIONS.removeDuplicates,
  }
}

/**
 * Sorts entries by version (descending - newest first).
 *
 * @param entries - Entries to sort
 * @returns Sorted entries
 */
function sortEntriesByVersion(entries: readonly ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => {
    if (a.unreleased && !b.unreleased) return -1
    if (!a.unreleased && b.unreleased) return 1
    if (a.unreleased && b.unreleased) return 0

    const aResult = parseVersion(a.version)
    const bResult = parseVersion(b.version)

    if (!aResult.success || !bResult.success) {
      return b.version.localeCompare(a.version)
    }

    return compare(bResult.version as SemVer, aResult.version as SemVer)
  })
}

/**
 * Appends entries from target to source (no conflict resolution).
 *
 * @param source - The base changelog to append to
 * @param target - The changelog whose entries will be appended
 * @param position - Where to insert ('start' or 'end')
 * @returns A new changelog with combined entries
 *
 * @example Appending entries to a changelog
 * ```typescript
 * const combined = appendChangelog(mainChangelog, newChangelog, 'start')
 * // newChangelog entries appear before mainChangelog entries
 * ```
 */
export function appendChangelog(source: Changelog, target: Changelog, position: 'start' | 'end' = 'end'): Changelog {
  const entries = position === 'start' ? [...target.entries, ...source.entries] : [...source.entries, ...target.entries]

  return {
    ...source,
    entries,
  }
}

/**
 * Combines multiple changelogs into one.
 *
 * @param changelogs - Array of changelogs to combine
 * @param options - Optional merge options
 * @returns The combined changelog
 *
 * @example Combining multiple changelogs
 * ```typescript
 * const unified = combineChangelogs([pkg1Changelog, pkg2Changelog], {
 *   strategy: 'merge-sections',
 * })
 * // All entries from both changelogs merged with conflict resolution
 * ```
 */
export function combineChangelogs(changelogs: readonly Changelog[], options?: MergeOptions): Changelog {
  if (changelogs.length === 0) {
    throw createError('At least one changelog is required')
  }

  if (changelogs.length === 1) {
    return changelogs[0] as Changelog
  }

  let result = changelogs[0] as Changelog
  for (const changelog of changelogs.slice(1)) {
    const mergeResult = mergeChangelogs(result, changelog, options)
    result = mergeResult.changelog
  }

  return result
}
