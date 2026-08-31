import type { Changelog } from '../models/changelog'
import type { ChangelogEntry, ChangelogSection, ChangelogItem } from '../models/entry'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Adds an item to a specific section within an entry.
 *
 * @param changelog - The changelog containing the entry to modify
 * @param version - The version identifier of the entry to update
 * @param sectionType - Category identifier for grouping changes (e.g., 'features', 'fixes')
 * @param item - Description of the change with optional scope and metadata
 * @returns A new changelog with the item added
 *
 * @example Adding a feature item to an entry
 * ```typescript
 * const item = { description: 'Add dark mode support', scope: 'ui' }
 * const updated = addItemToEntry(changelog, '1.2.0', 'features', item)
 * // Item added to the features section of version 1.2.0
 * ```
 */
export function addItemToEntry(changelog: Changelog, version: string, sectionType: string, item: ChangelogItem): Changelog {
  const entryIndex = changelog.entries.findIndex((e) => e.version === version)
  const entry = changelog.entries[entryIndex]

  if (entryIndex === -1 || !entry) {
    throw createError(`Entry with version "${version}" not found`)
  }

  const sectionIndex = entry.sections.findIndex((s) => s.type === sectionType)

  let newSections: ChangelogSection[]

  if (sectionIndex === -1) {
    newSections = [
      ...entry.sections,
      {
        type: sectionType as ChangelogSection['type'],
        heading: sectionType.charAt(0).toUpperCase() + sectionType.slice(1),
        items: [item],
      },
    ]
  } else {
    const existingSection = entry.sections[sectionIndex]
    if (!existingSection) {
      throw createError(`Section at index ${sectionIndex} not found`)
    }
    newSections = [...entry.sections]
    newSections[sectionIndex] = {
      ...existingSection,
      items: [...existingSection.items, item],
    }
  }

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
