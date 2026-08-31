import type { SemVer } from '../../semver/models/version'
import type { Changelog, ChangelogHeader, ChangelogMetadata } from '../models/changelog'
import type { ChangelogEntry, ChangelogSection, ChangelogItem } from '../models/entry'
import type { ChangelogSectionType } from '../models/section'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compare } from '../../semver/compare/compare'
import { parseVersion } from '../../semver/parse/version'
import { SECTION_HEADINGS } from '../models/section'

/**
 * Transformation function for entries.
 */
export type EntryTransformer = (entry: ChangelogEntry, index: number) => ChangelogEntry

/**
 * Transformation function for sections.
 */
export type SectionTransformer = (section: ChangelogSection, entry: ChangelogEntry) => ChangelogSection

/**
 * Transformation function for items.
 */
export type ItemTransformer = (item: ChangelogItem, section: ChangelogSection, entry: ChangelogEntry) => ChangelogItem

/**
 * Transforms all entries in a changelog.
 *
 * @param changelog - The changelog to transform
 * @param transformer - Function to transform each entry
 * @returns A new changelog with transformed entries
 *
 * @example Transforming all entries
 * ```ts
 * const transformed = transformEntries(changelog, (entry) => ({
 *   ...entry,
 *   date: entry.date?.toUpperCase()
 * }))
 * ```
 */
export function transformEntries(changelog: Changelog, transformer: EntryTransformer): Changelog {
  const newEntries = changelog.entries.map(transformer)

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Transforms all sections in all entries.
 *
 * @param changelog - The changelog to transform
 * @param transformer - Function to transform each section
 * @returns A new changelog with transformed sections
 *
 * @example Uppercasing section headings
 * ```typescript
 * const renamed = transformSections(changelog, (section) => ({
 *   ...section,
 *   heading: section.heading.toUpperCase(),
 * }))
 * ```
 */
export function transformSections(changelog: Changelog, transformer: SectionTransformer): Changelog {
  const newEntries = changelog.entries.map((entry) => ({
    ...entry,
    sections: entry.sections.map((section) => transformer(section, entry)),
  }))

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Transforms all items in all sections.
 *
 * @param changelog - The changelog to transform
 * @param transformer - Function to transform each item
 * @returns A new changelog with transformed items
 *
 * @example Prefixing item descriptions with scope
 * ```typescript
 * const prefixed = transformItems(changelog, (item) => ({
 *   ...item,
 *   description: `[${item.scope || 'misc'}] ${item.description}`,
 * }))
 * ```
 */
export function transformItems(changelog: Changelog, transformer: ItemTransformer): Changelog {
  const newEntries = changelog.entries.map((entry) => ({
    ...entry,
    sections: entry.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => transformer(item, section, entry)),
    })),
  }))

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Updates the header of a changelog.
 *
 * @param changelog - The changelog to update
 * @param updates - Partial header updates
 * @returns A new changelog with updated header
 *
 * @example Updating the changelog header
 * ```typescript
 * const updated = updateHeader(changelog, { title: '# Release Notes' })
 * ```
 */
export function updateHeader(changelog: Changelog, updates: Partial<ChangelogHeader>): Changelog {
  return {
    ...changelog,
    header: {
      ...changelog.header,
      ...updates,
    },
  }
}

/**
 * Updates the metadata of a changelog.
 *
 * @param changelog - The changelog to update
 * @param updates - Partial metadata updates
 * @returns A new changelog with updated metadata
 *
 * @example Updating changelog metadata
 * ```typescript
 * const updated = updateMetadata(changelog, { repositoryUrl: 'https://github.com/org/repo' })
 * ```
 */
export function updateMetadata(changelog: Changelog, updates: Partial<ChangelogMetadata>): Changelog {
  return {
    ...changelog,
    metadata: {
      ...changelog.metadata,
      ...updates,
    },
  }
}

/**
 * Updates a specific entry by version.
 *
 * @param changelog - The changelog to update
 * @param version - Version of entry to update
 * @param updates - Partial entry updates or transformer function
 * @returns A new changelog with updated entry
 *
 * @example Updating a specific entry
 * ```typescript
 * const updated = updateEntry(changelog, '1.0.0', { date: '2024-01-15' })
 *
 * // Or with transformer function
 * const modified = updateEntry(changelog, '1.0.0', (entry) => ({
 *   ...entry,
 *   compareUrl: `https://github.com/org/repo/compare/v0.9.0...v${entry.version}`,
 * }))
 * ```
 */
export function updateEntry(
  changelog: Changelog,
  version: string,
  updates: Partial<ChangelogEntry> | ((entry: ChangelogEntry) => ChangelogEntry)
): Changelog {
  const entryIndex = changelog.entries.findIndex((e) => e.version === version)

  if (entryIndex === -1) {
    throw createError(`Entry with version "${version}" not found`)
  }

  const entry = changelog.entries[entryIndex] as ChangelogEntry
  const updatedEntry = typeof updates === 'function' ? updates(entry) : { ...entry, ...updates }

  const newEntries = [...changelog.entries]
  newEntries[entryIndex] = updatedEntry

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Sorts entries by version (descending - newest first).
 *
 * @param changelog - The changelog to sort
 * @returns A new changelog with sorted entries
 *
 * @example Sorting changelog entries by version
 * ```typescript
 * const sorted = sortEntries(changelog)
 * // Entries ordered: Unreleased, 2.0.0, 1.1.0, 1.0.0, ...
 * ```
 */
export function sortEntries(changelog: Changelog): Changelog {
  const sorted = [...changelog.entries].sort((a, b) => {
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

  return {
    ...changelog,
    entries: sorted,
  }
}

/**
 * Sorts entries by date (newest first).
 *
 * @param changelog - The changelog to sort
 * @returns A new changelog with sorted entries
 *
 * @example Sorting entries by date
 * ```typescript
 * const sorted = sortEntriesByDate(changelog)
 * // Entries ordered by release date, most recent first
 * ```
 */
export function sortEntriesByDate(changelog: Changelog): Changelog {
  const sorted = [...changelog.entries].sort((a, b) => {
    if (a.unreleased && !b.unreleased) return -1
    if (!a.unreleased && b.unreleased) return 1
    if (a.unreleased && b.unreleased) return 0

    if (!a.date && b.date) return 1
    if (a.date && !b.date) return -1
    if (!a.date && !b.date) return 0

    return (b.date as string).localeCompare(a.date as string)
  })

  return {
    ...changelog,
    entries: sorted,
  }
}

/**
 * Reverses the order of entries.
 *
 * @param changelog - The changelog to reverse
 * @returns A new changelog with reversed entries
 *
 * @example Reversing entry order
 * ```typescript
 * const reversed = reverseEntries(changelog)
 * // Oldest entries now appear first
 * ```
 */
export function reverseEntries(changelog: Changelog): Changelog {
  return {
    ...changelog,
    entries: [...changelog.entries].reverse(),
  }
}

/**
 * Sorts sections within each entry by a specified order.
 *
 * @param changelog - The changelog to sort
 * @param order - Optional custom section order (defaults to standard order)
 * @returns A new changelog with sorted sections
 *
 * @example Sorting sections within entries
 * ```typescript
 * const sorted = sortSections(changelog)
 * // Sections in each entry follow: breaking, features, fixes, ...
 *
 * const custom = sortSections(changelog, ['fixes', 'features', 'breaking'])
 * // Custom ordering: fixes first, then features, then breaking
 * ```
 */
export function sortSections(changelog: Changelog, order?: readonly ChangelogSectionType[]): Changelog {
  const defaultOrder: ChangelogSectionType[] = [
    'breaking',
    'features',
    'fixes',
    'performance',
    'documentation',
    'deprecations',
    'refactoring',
    'tests',
    'build',
    'ci',
    'chores',
    'other',
  ]

  const sectionOrder = order ?? defaultOrder
  const orderMap = createMap<string, number>()
  sectionOrder.forEach((type, index) => orderMap.set(type, index))

  const newEntries = changelog.entries.map((entry) => ({
    ...entry,
    sections: [...entry.sections].sort((a, b) => {
      const orderA = orderMap.get(a.type) ?? Number.MAX_SAFE_INTEGER
      const orderB = orderMap.get(b.type) ?? Number.MAX_SAFE_INTEGER
      return orderA - orderB
    }),
  }))

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Normalizes section headings to standard format.
 *
 * @param changelog - The changelog to normalize
 * @returns A new changelog with normalized section headings
 *
 * @example Normalizing section headings
 * ```typescript
 * const normalized = normalizeSectionHeadings(changelog)
 * // 'New Features' becomes 'Added', 'Bug Fixes' becomes 'Fixed', etc.
 * ```
 */
export function normalizeSectionHeadings(changelog: Changelog): Changelog {
  return transformSections(changelog, (section) => ({
    ...section,
    heading: SECTION_HEADINGS[section.type] ?? section.heading,
  }))
}

/**
 * Removes duplicate items across all sections.
 *
 * @param changelog - The changelog to deduplicate
 * @returns A new changelog without duplicate items
 *
 * @example Deduplicating items across sections
 * ```typescript
 * const deduped = deduplicateItems(changelog)
 * // Duplicate items (same scope:description) are removed
 * ```
 */
export function deduplicateItems(changelog: Changelog): Changelog {
  const newEntries = changelog.entries.map((entry) => {
    const seenDescriptions = createSet<string>()
    const newSections = entry.sections.map((section) => {
      const uniqueItems: ChangelogItem[] = []

      for (const item of section.items) {
        const key = `${item.scope ?? ''}:${item.description}`
        if (!seenDescriptions.has(key)) {
          seenDescriptions.add(key)
          uniqueItems.push(item)
        }
      }

      return {
        ...section,
        items: uniqueItems,
      }
    })

    return {
      ...entry,
      sections: newSections,
    }
  })

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Compacts a changelog by removing empty sections and entries.
 *
 * @param changelog - The changelog to compact
 * @param keepUnreleased - Whether to keep empty unreleased entry (default: true)
 * @returns A new compacted changelog
 *
 * @example Compacting a changelog
 * ```typescript
 * const compacted = compact(changelog)
 * // Empty sections and entries removed (unreleased kept)
 *
 * const strict = compact(changelog, false)
 * // Even empty unreleased entry is removed
 * ```
 */
export function compact(changelog: Changelog, keepUnreleased = true): Changelog {
  const newEntries = changelog.entries
    .map((entry) => ({
      ...entry,
      sections: entry.sections.filter((s) => s.items.length > 0),
    }))
    .filter((entry) => {
      const hasContent = entry.sections.length > 0 || entry.rawContent
      if (hasContent) return true
      if (keepUnreleased && entry.unreleased) return true
      return false
    })

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Strips metadata from a changelog.
 *
 * @param changelog - The changelog to strip
 * @returns A new changelog with minimal metadata
 *
 * @example Stripping metadata from a changelog
 * ```typescript
 * const stripped = stripMetadata(changelog)
 * // Source and warnings removed, only format and isConventional retained
 * ```
 */
export function stripMetadata(changelog: Changelog): Changelog {
  return {
    ...changelog,
    source: undefined,
    metadata: {
      format: changelog.metadata.format,
      isConventional: changelog.metadata.isConventional,
      warnings: [],
    },
  }
}

/**
 * Clones a changelog deeply (for modification without affecting original).
 *
 * @param changelog - The changelog to clone
 * @returns A deep copy of the changelog
 *
 * @example Cloning a changelog
 * ```typescript
 * const copy = cloneChangelog(changelog)
 * // Independent deep copy, safe to mutate
 * ```
 */
export function cloneChangelog(changelog: Changelog): Changelog {
  return {
    source: changelog.source,
    header: {
      title: changelog.header.title,
      description: [...changelog.header.description],
      links: changelog.header.links.map((link) => ({ ...link })),
    },
    entries: changelog.entries.map((entry) => ({
      version: entry.version,
      date: entry.date,
      unreleased: entry.unreleased,
      compareUrl: entry.compareUrl,
      rawContent: entry.rawContent,
      sections: entry.sections.map((section) => ({
        type: section.type,
        heading: section.heading,
        items: section.items.map((item) => ({
          scope: item.scope,
          description: item.description,
          breaking: item.breaking,
          commits: item.commits.map((commit) => ({ ...commit })),
          references: item.references.map((ref) => ({ ...ref })),
        })),
      })),
    })),
    metadata: {
      format: changelog.metadata.format,
      isConventional: changelog.metadata.isConventional,
      repositoryUrl: changelog.metadata.repositoryUrl,
      packageName: changelog.metadata.packageName,
      warnings: [...changelog.metadata.warnings],
    },
  }
}
