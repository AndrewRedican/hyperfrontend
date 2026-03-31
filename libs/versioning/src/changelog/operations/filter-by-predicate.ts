import type { Changelog } from '../models/changelog'
import type { ChangelogEntry, ChangelogSection, ChangelogItem } from '../models/entry'
import type { ChangelogSectionType } from '../models/section'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Predicate function for filtering entries.
 */
export type EntryPredicate = (entry: ChangelogEntry, index: number) => boolean

/**
 * Predicate function for filtering sections.
 */
export type SectionPredicate = (section: ChangelogSection, entry: ChangelogEntry) => boolean

/**
 * Predicate function for filtering items.
 */
export type ItemPredicate = (item: ChangelogItem, section: ChangelogSection, entry: ChangelogEntry) => boolean

/**
 * Filters entries using a predicate function.
 *
 * @param changelog - The changelog to filter
 * @param predicate - Function that returns true for entries to keep
 * @returns A new changelog with filtered entries
 *
 * @example
 * ```ts
 * const filtered = filterEntries(changelog, (entry) => !entry.unreleased)
 * ```
 */
export function filterEntries(changelog: Changelog, predicate: EntryPredicate): Changelog {
  const newEntries = changelog.entries.filter(predicate)

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Filters entries that have breaking changes.
 *
 * @param changelog - The changelog to filter
 * @returns A new changelog with only entries containing breaking changes
 */
export function filterBreakingChanges(changelog: Changelog): Changelog {
  return filterEntries(changelog, (entry) => {
    // Check for breaking section
    const hasBreakingSection = entry.sections.some((s) => s.type === 'breaking')
    if (hasBreakingSection) return true

    // Check for breaking items in other sections
    return entry.sections.some((section) => section.items.some((item) => item.breaking))
  })
}

/**
 * Filters sections within each entry.
 *
 * @param changelog - The changelog to filter
 * @param predicate - Function that returns true for sections to keep
 * @returns A new changelog with filtered sections
 */
export function filterSections(changelog: Changelog, predicate: SectionPredicate): Changelog {
  const newEntries = changelog.entries.map((entry) => ({
    ...entry,
    sections: entry.sections.filter((section) => predicate(section, entry)),
  }))

  return { ...changelog, entries: newEntries }
}

/**
 * Keeps only specified section types.
 *
 * @param changelog - The changelog to filter
 * @param types - Section types to keep
 * @returns A new changelog with only specified section types
 */
export function filterSectionTypes(changelog: Changelog, types: readonly ChangelogSectionType[]): Changelog {
  const typeSet = createSet<string>(types)

  return filterSections(changelog, (section) => typeSet.has(section.type))
}

/**
 * Filters items within sections.
 *
 * @param changelog - The changelog to filter
 * @param predicate - Function that returns true for items to keep
 * @returns A new changelog with filtered items
 */
export function filterItems(changelog: Changelog, predicate: ItemPredicate): Changelog {
  const newEntries = changelog.entries.map((entry) => ({
    ...entry,
    sections: entry.sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => predicate(item, section, entry)),
    })),
  }))

  return { ...changelog, entries: newEntries }
}

/**
 * Filters items by scope.
 *
 * @param changelog - The changelog to filter
 * @param scopes - Scopes to include
 * @returns A new changelog with only items matching the scopes
 */
export function filterByScope(changelog: Changelog, scopes: readonly string[]): Changelog {
  const scopeSet = createSet(scopes)

  return filterItems(changelog, (item) => {
    if (!item.scope) return false
    return scopeSet.has(item.scope)
  })
}

/**
 * Excludes items by scope.
 *
 * @param changelog - The changelog to filter
 * @param scopes - Scopes to exclude
 * @returns A new changelog without items matching the scopes
 */
export function excludeByScope(changelog: Changelog, scopes: readonly string[]): Changelog {
  const scopeSet = createSet(scopes)

  return filterItems(changelog, (item) => {
    if (!item.scope) return true
    return !scopeSet.has(item.scope)
  })
}
