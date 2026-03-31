import type { Changelog } from '../models/changelog'
import type { ChangelogEntry, ChangelogSection } from '../models/entry'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Options for removing a section or item.
 */
export interface RemoveSectionOptions {
  /** Throw error if section/item not found (default: true) */
  readonly throwIfNotFound?: boolean
}

/**
 * Removes a section from an entry.
 *
 * @param changelog - The changelog containing the entry to modify
 * @param version - The version of the entry to modify
 * @param sectionType - The section type to remove
 * @param options - Optional removal options
 * @returns A new changelog without the specified section
 */
export function removeSection(changelog: Changelog, version: string, sectionType: string, options?: RemoveSectionOptions): Changelog {
  const throwIfNotFound = options?.throwIfNotFound ?? true
  const entryIndex = changelog.entries.findIndex((e) => e.version === version)

  if (entryIndex === -1) {
    if (throwIfNotFound) {
      throw createError(`Entry with version "${version}" not found`)
    }
    return changelog
  }

  const entry = changelog.entries[entryIndex]
  const sectionIndex = entry.sections.findIndex((s) => s.type === sectionType)

  if (sectionIndex === -1) {
    if (throwIfNotFound) {
      throw createError(`Section with type "${sectionType}" not found in version "${version}"`)
    }
    return changelog
  }

  const newSections = [...entry.sections]
  newSections.splice(sectionIndex, 1)

  const newEntry: ChangelogEntry = {
    ...entry,
    sections: newSections,
  }

  const newEntries = [...changelog.entries]
  newEntries[entryIndex] = newEntry

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Removes an item from an entry by description.
 *
 * @param changelog - The changelog containing the entry to modify
 * @param version - The version of the entry to modify
 * @param sectionType - The section type containing the item
 * @param itemDescription - The description of the item to remove
 * @param options - Optional removal options
 * @returns A new changelog without the specified item
 */
export function removeItem(
  changelog: Changelog,
  version: string,
  sectionType: string,
  itemDescription: string,
  options?: RemoveSectionOptions
): Changelog {
  const throwIfNotFound = options?.throwIfNotFound ?? true
  const entryIndex = changelog.entries.findIndex((e) => e.version === version)

  if (entryIndex === -1) {
    if (throwIfNotFound) {
      throw createError(`Entry with version "${version}" not found`)
    }
    return changelog
  }

  const entry = changelog.entries[entryIndex]
  const sectionIndex = entry.sections.findIndex((s) => s.type === sectionType)

  if (sectionIndex === -1) {
    if (throwIfNotFound) {
      throw createError(`Section with type "${sectionType}" not found in version "${version}"`)
    }
    return changelog
  }

  const section = entry.sections[sectionIndex]
  const itemIndex = section.items.findIndex((i) => i.description === itemDescription)

  if (itemIndex === -1) {
    if (throwIfNotFound) {
      throw createError(`Item with description "${itemDescription}" not found in section "${sectionType}"`)
    }
    return changelog
  }

  const newItems = [...section.items]
  newItems.splice(itemIndex, 1)

  const newSection: ChangelogSection = {
    ...section,
    items: newItems,
  }

  const newSections = [...entry.sections]
  newSections[sectionIndex] = newSection

  const newEntry: ChangelogEntry = {
    ...entry,
    sections: newSections,
  }

  const newEntries = [...changelog.entries]
  newEntries[entryIndex] = newEntry

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Removes empty sections from all entries.
 *
 * @param changelog - The changelog to remove empty sections from
 * @returns A new changelog with empty sections removed
 */
export function removeEmptySections(changelog: Changelog): Changelog {
  const newEntries = changelog.entries.map((entry) => {
    const nonEmptySections = entry.sections.filter((s) => s.items.length > 0)

    if (nonEmptySections.length === entry.sections.length) {
      return entry // No change
    }

    return {
      ...entry,
      sections: nonEmptySections,
    }
  })

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Removes empty entries (entries with no sections or only empty sections).
 *
 * @param changelog - The changelog to remove empty entries from
 * @param keepUnreleased - Whether to keep an empty unreleased entry (default: true)
 * @returns A new changelog with empty entries removed
 */
export function removeEmptyEntries(changelog: Changelog, keepUnreleased = true): Changelog {
  const newEntries = changelog.entries.filter((entry) => {
    // Check if entry has any items
    const hasItems = entry.sections.some((s) => s.items.length > 0)

    if (hasItems) return true
    if (keepUnreleased && entry.unreleased) return true
    if (entry.rawContent) return true

    return false
  })

  return {
    ...changelog,
    entries: newEntries,
  }
}
