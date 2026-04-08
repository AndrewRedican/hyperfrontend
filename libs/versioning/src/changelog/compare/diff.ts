import type { Changelog } from '../models/changelog'
import type { CommitRef, IssueRef } from '../models/commit-ref'
import type { ChangelogEntry, ChangelogItem, ChangelogSection } from '../models/entry'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isEntryEqual, isSectionEqual, isItemEqual, isCommitRefEqual, isIssueRefEqual } from './is-equal'

/**
 * Represents the diff between two changelogs.
 */
export interface ChangelogDiff {
  /** Entries added in target but not in source */
  readonly added: readonly ChangelogEntry[]

  /** Entries removed from source but not in target */
  readonly removed: readonly ChangelogEntry[]

  /** Entries present in both but with differences */
  readonly modified: readonly EntryDiff[]

  /** Whether changelogs are structurally identical */
  readonly identical: boolean

  /** Summary statistics */
  readonly stats: DiffStats
}

/**
 * Statistics about the diff.
 */
export interface DiffStats {
  /** Number of added entries */
  readonly addedCount: number

  /** Number of removed entries */
  readonly removedCount: number

  /** Number of modified entries */
  readonly modifiedCount: number

  /** Total number of property changes across all modified entries */
  readonly totalChanges: number
}

/**
 * Represents differences in a single entry.
 */
export interface EntryDiff {
  /** Version of the entry */
  readonly version: string

  /** Original entry (from source) */
  readonly source: ChangelogEntry

  /** Modified entry (from target) */
  readonly target: ChangelogEntry

  /** List of property differences */
  readonly changes: readonly PropertyDiff[]

  /** Sections added in target */
  readonly addedSections: readonly ChangelogSection[]

  /** Sections removed from source */
  readonly removedSections: readonly ChangelogSection[]

  /** Sections that were modified */
  readonly modifiedSections: readonly SectionDiff[]
}

/**
 * Represents differences in a single section.
 */
export interface SectionDiff {
  /** Section type */
  readonly type: string

  /** Original section (from source) */
  readonly source: ChangelogSection

  /** Modified section (from target) */
  readonly target: ChangelogSection

  /** Items added in target */
  readonly addedItems: readonly ChangelogItem[]

  /** Items removed from source */
  readonly removedItems: readonly ChangelogItem[]

  /** Items that were modified */
  readonly modifiedItems: readonly ItemDiff[]
}

/**
 * Represents differences in a single item.
 */
export interface ItemDiff {
  /** Description from source */
  readonly sourceDescription: string

  /** Source item */
  readonly source: ChangelogItem

  /** Target item */
  readonly target: ChangelogItem

  /** List of property changes */
  readonly changes: readonly PropertyDiff[]
}

/**
 * Represents a single property difference.
 */
export interface PropertyDiff {
  /** Path to the property (e.g., ['date'], ['sections', '0', 'heading']) */
  readonly path: readonly string[]

  /** Type of change */
  readonly type: 'added' | 'removed' | 'changed'

  /** Previous value (for 'removed' and 'changed') */
  readonly oldValue?: unknown

  /** New value (for 'added' and 'changed') */
  readonly newValue?: unknown
}

/**
 * Computes the diff between two changelogs.
 *
 * @param source - The source/original changelog
 * @param target - The target/modified changelog
 * @returns Detailed diff of changes
 *
 * @example
 * ```ts
 * const diff = diffChangelogs(mainChangelog, branchChangelog)
 * console.log(`Added: ${diff.added.length}, Removed: ${diff.removed.length}`)
 * ```
 */
export function diffChangelogs(source: Changelog, target: Changelog): ChangelogDiff {
  const sourceVersions = createMap<string, ChangelogEntry>()
  const targetVersions = createMap<string, ChangelogEntry>()

  for (const entry of source.entries) {
    sourceVersions.set(entry.version, entry)
  }

  for (const entry of target.entries) {
    targetVersions.set(entry.version, entry)
  }

  const added: ChangelogEntry[] = []
  const removed: ChangelogEntry[] = []
  const modified: EntryDiff[] = []

  for (const [version, entry] of targetVersions) {
    if (!sourceVersions.has(version)) {
      added.push(entry)
    }
  }

  for (const [version, entry] of sourceVersions) {
    if (!targetVersions.has(version)) {
      removed.push(entry)
    }
  }

  for (const [version, sourceEntry] of sourceVersions) {
    const targetEntry = targetVersions.get(version)
    if (targetEntry && !isEntryEqual(sourceEntry, targetEntry)) {
      const entryDiff = diffEntries(sourceEntry, targetEntry)
      modified.push(entryDiff)
    }
  }

  const identical = added.length === 0 && removed.length === 0 && modified.length === 0

  const totalChanges = modified.reduce(
    (sum, m) =>
      sum +
      m.changes.length +
      m.addedSections.length +
      m.removedSections.length +
      m.modifiedSections.reduce((s, ms) => s + ms.addedItems.length + ms.removedItems.length + ms.modifiedItems.length, 0),
    0
  )

  return {
    added,
    removed,
    modified,
    identical,
    stats: {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      totalChanges,
    },
  }
}

/**
 * Computes the diff between two changelog entries.
 *
 * @param source - The source entry
 * @param target - The target entry
 * @returns Detailed entry diff
 *
 * @example
 * ```typescript
 * const diff = diffEntries(entryV1, entryV2)
 * // => { version: '1.0.0', changes: [{ path: ['date'], type: 'changed', ... }], sectionsChanged: true }
 * ```
 */
export function diffEntries(source: ChangelogEntry, target: ChangelogEntry): EntryDiff {
  const changes: PropertyDiff[] = []

  if (source.date !== target.date) {
    changes.push({
      path: ['date'],
      type: source.date === null ? 'added' : target.date === null ? 'removed' : 'changed',
      oldValue: source.date,
      newValue: target.date,
    })
  }

  if (source.unreleased !== target.unreleased) {
    changes.push({
      path: ['unreleased'],
      type: 'changed',
      oldValue: source.unreleased,
      newValue: target.unreleased,
    })
  }

  if (source.compareUrl !== target.compareUrl) {
    changes.push({
      path: ['compareUrl'],
      type: source.compareUrl === undefined ? 'added' : target.compareUrl === undefined ? 'removed' : 'changed',
      oldValue: source.compareUrl,
      newValue: target.compareUrl,
    })
  }

  if (source.rawContent !== target.rawContent) {
    changes.push({
      path: ['rawContent'],
      type: source.rawContent === undefined ? 'added' : target.rawContent === undefined ? 'removed' : 'changed',
      oldValue: source.rawContent,
      newValue: target.rawContent,
    })
  }

  const { added: addedSections, removed: removedSections, modified: modifiedSections } = diffSections(source.sections, target.sections)

  return {
    version: source.version,
    source,
    target,
    changes,
    addedSections,
    removedSections,
    modifiedSections,
  }
}

/**
 * Diffs two section arrays.
 *
 * @param sourceSections - Array of sections from the source changelog
 * @param targetSections - Array of sections from the target changelog
 * @returns Diff result with added, removed, and modified sections
 */
function diffSections(
  sourceSections: readonly ChangelogSection[],
  targetSections: readonly ChangelogSection[]
): {
  /** Sections present in target but not in source */
  added: ChangelogSection[]
  /** Sections present in source but not in target */
  removed: ChangelogSection[]
  /** Sections present in both with differences */
  modified: SectionDiff[]
} {
  const sourceByType = createMap<string, ChangelogSection>()
  const targetByType = createMap<string, ChangelogSection>()

  for (const section of sourceSections) {
    sourceByType.set(section.type, section)
  }

  for (const section of targetSections) {
    targetByType.set(section.type, section)
  }

  const added: ChangelogSection[] = []
  const removed: ChangelogSection[] = []
  const modified: SectionDiff[] = []

  for (const [type, section] of targetByType) {
    if (!sourceByType.has(type)) {
      added.push(section)
    }
  }

  for (const [type, section] of sourceByType) {
    if (!targetByType.has(type)) {
      removed.push(section)
    }
  }

  for (const [type, sourceSection] of sourceByType) {
    const targetSection = targetByType.get(type)
    if (targetSection && !isSectionEqual(sourceSection, targetSection)) {
      const sectionDiff = diffSection(sourceSection, targetSection)
      modified.push(sectionDiff)
    }
  }

  return { added, removed, modified }
}

/**
 * Diffs two sections.
 *
 * @param source - Section from the source changelog to compare
 * @param target - Section from the target changelog to compare against
 * @returns Detailed section diff
 */
function diffSection(source: ChangelogSection, target: ChangelogSection): SectionDiff {
  const sourceByDesc = createMap<string, ChangelogItem>()
  const targetByDesc = createMap<string, ChangelogItem>()

  for (const item of source.items) {
    sourceByDesc.set(item.description, item)
  }

  for (const item of target.items) {
    targetByDesc.set(item.description, item)
  }

  const addedItems: ChangelogItem[] = []
  const removedItems: ChangelogItem[] = []
  const modifiedItems: ItemDiff[] = []

  for (const [desc, item] of targetByDesc) {
    if (!sourceByDesc.has(desc)) {
      addedItems.push(item)
    }
  }

  for (const [desc, item] of sourceByDesc) {
    if (!targetByDesc.has(desc)) {
      removedItems.push(item)
    }
  }

  for (const [desc, sourceItem] of sourceByDesc) {
    const targetItem = targetByDesc.get(desc)
    if (targetItem && !isItemEqual(sourceItem, targetItem)) {
      const itemDiff = diffItem(sourceItem, targetItem)
      modifiedItems.push(itemDiff)
    }
  }

  return {
    type: source.type,
    source,
    target,
    addedItems,
    removedItems,
    modifiedItems,
  }
}

/**
 * Diffs two changelog items.
 *
 * @param source - The item from the source changelog to compare
 * @param target - The item from the target changelog to compare against
 * @returns Detailed item diff
 */
function diffItem(source: ChangelogItem, target: ChangelogItem): ItemDiff {
  const changes: PropertyDiff[] = []

  if (source.scope !== target.scope) {
    changes.push({
      path: ['scope'],
      type: source.scope === undefined ? 'added' : target.scope === undefined ? 'removed' : 'changed',
      oldValue: source.scope,
      newValue: target.scope,
    })
  }

  if (source.breaking !== target.breaking) {
    changes.push({
      path: ['breaking'],
      type: 'changed',
      oldValue: source.breaking,
      newValue: target.breaking,
    })
  }

  if (!areCommitRefsEqual(source.commits, target.commits)) {
    changes.push({
      path: ['commits'],
      type: 'changed',
      oldValue: source.commits,
      newValue: target.commits,
    })
  }

  if (!areIssueRefsEqual(source.references, target.references)) {
    changes.push({
      path: ['references'],
      type: 'changed',
      oldValue: source.references,
      newValue: target.references,
    })
  }

  return {
    sourceDescription: source.description,
    source,
    target,
    changes,
  }
}

/**
 * Checks if two commit ref arrays are equal.
 *
 * @param a - First array of commit references to compare
 * @param b - Second array of commit references to compare
 * @returns True if both arrays contain equivalent commit refs
 */
function areCommitRefsEqual(a: readonly CommitRef[], b: readonly CommitRef[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const aRef = a[i]
    const bRef = b[i]
    if (aRef === undefined || bRef === undefined || !isCommitRefEqual(aRef, bRef)) return false
  }
  return true
}

/**
 * Checks if two issue ref arrays are equal.
 *
 * @param a - First array of issue references to compare
 * @param b - Second array of issue references to compare
 * @returns True if both arrays contain equivalent issue refs
 */
function areIssueRefsEqual(a: readonly IssueRef[], b: readonly IssueRef[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const aRef = a[i]
    const bRef = b[i]
    if (aRef === undefined || bRef === undefined || !isIssueRefEqual(aRef, bRef)) return false
  }
  return true
}

/**
 * Creates a human-readable summary of a changelog diff.
 *
 * @param diff - The diff to summarize
 * @returns A string summary of the changes
 *
 * @example
 * ```typescript
 * const diff = diffChangelogs(oldChangelog, newChangelog)
 * summarizeDiff(diff)
 * // => 'Added 2 version(s): 1.2.0, 1.1.0; Modified 1 version(s): 1.0.0'
 * ```
 */
export function summarizeDiff(diff: ChangelogDiff): string {
  if (diff.identical) {
    return 'Changelogs are identical'
  }

  const parts: string[] = []

  if (diff.added.length > 0) {
    const versions = diff.added.map((e) => e.version).join(', ')
    parts.push(`Added ${diff.added.length} version(s): ${versions}`)
  }

  if (diff.removed.length > 0) {
    const versions = diff.removed.map((e) => e.version).join(', ')
    parts.push(`Removed ${diff.removed.length} version(s): ${versions}`)
  }

  if (diff.modified.length > 0) {
    const versions = diff.modified.map((e) => e.version).join(', ')
    parts.push(`Modified ${diff.modified.length} version(s): ${versions}`)
  }

  return parts.join('; ')
}
