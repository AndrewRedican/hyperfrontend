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
 */
export function addItemToEntry(changelog: Changelog, version: string, sectionType: string, item: ChangelogItem): Changelog {
  const entryIndex = changelog.entries.findIndex((e) => e.version === version)

  if (entryIndex === -1) {
    throw createError(`Entry with version "${version}" not found`)
  }

  const entry = changelog.entries[entryIndex]
  const sectionIndex = entry.sections.findIndex((s) => s.type === sectionType)

  let newSections: ChangelogSection[]

  if (sectionIndex === -1) {
    // Create new section
    newSections = [
      ...entry.sections,
      {
        type: <ChangelogSection['type']>sectionType,
        heading: sectionType.charAt(0).toUpperCase() + sectionType.slice(1),
        items: [item],
      },
    ]
  } else {
    // Add to existing section
    newSections = [...entry.sections]
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      items: [...newSections[sectionIndex].items, item],
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
