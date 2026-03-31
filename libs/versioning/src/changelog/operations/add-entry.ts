import type { Changelog, ChangelogMetadata } from '../models/changelog'
import type { ChangelogEntry, ChangelogSection } from '../models/entry'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createChangelogEntry, createUnreleasedEntry } from '../models/entry'

/**
 * Options for adding an entry.
 */
export interface AddEntryOptions {
  /** Position to insert (default: 0, at the beginning) */
  readonly position?: number | 'start' | 'end'

  /** Replace existing entry with same version */
  readonly replaceExisting?: boolean

  /** Update metadata after adding */
  readonly updateMetadata?: boolean
}

/**
 * Adds a new entry to a changelog.
 *
 * @param changelog - The changelog to add to
 * @param entry - The entry to add
 * @param options - Optional add options
 * @returns A new changelog with the entry added
 *
 * @example
 * ```ts
 * const newChangelog = addEntry(changelog, {
 *   version: '1.2.0',
 *   date: '2024-01-15',
 *   unreleased: false,
 *   sections: [...]
 * })
 * ```
 */
export function addEntry(changelog: Changelog, entry: ChangelogEntry, options?: AddEntryOptions): Changelog {
  const position = options?.position ?? 'start'
  const replaceExisting = options?.replaceExisting ?? false
  const updateMetadata = options?.updateMetadata ?? false

  // Check for existing entry
  const existingIndex = changelog.entries.findIndex((e) => e.version === entry.version)

  if (existingIndex !== -1 && !replaceExisting) {
    throw createError(`Entry with version "${entry.version}" already exists. Use replaceExisting: true to replace.`)
  }

  let newEntries: ChangelogEntry[]

  if (existingIndex !== -1 && replaceExisting) {
    // Replace existing entry
    newEntries = [...changelog.entries]
    newEntries[existingIndex] = entry
  } else {
    // Add new entry
    const insertIndex = position === 'start' ? 0 : position === 'end' ? changelog.entries.length : position

    newEntries = [...changelog.entries]
    newEntries.splice(insertIndex, 0, entry)
  }

  // Build new metadata if requested
  const metadata: ChangelogMetadata = updateMetadata ? { ...changelog.metadata, warnings: [] } : changelog.metadata

  return {
    ...changelog,
    entries: newEntries,
    metadata,
  }
}

/**
 * Adds or updates an unreleased entry.
 *
 * @param changelog - The changelog to add the unreleased entry to
 * @param sections - Sections to include in the unreleased entry
 * @returns A new changelog with unreleased entry added/updated
 */
export function addUnreleasedEntry(changelog: Changelog, sections: readonly ChangelogSection[]): Changelog {
  const unreleasedEntry = createUnreleasedEntry(sections)
  return addEntry(changelog, unreleasedEntry, { position: 'start', replaceExisting: true })
}

/**
 * Creates a new release entry from the current unreleased entry.
 *
 * @param changelog - The changelog containing the unreleased entry
 * @param version - The version number for the release
 * @param date - The release date (defaults to today)
 * @param compareUrl - Optional comparison URL
 * @returns A new changelog with the unreleased entry converted to a release
 */
export function releaseUnreleased(changelog: Changelog, version: string, date?: string, compareUrl?: string): Changelog {
  const unreleasedIndex = changelog.entries.findIndex((e) => e.unreleased)

  if (unreleasedIndex === -1) {
    throw createError('No unreleased entry found')
  }

  const unreleased = changelog.entries[unreleasedIndex]
  const releaseDate = date ?? createDate().toISOString().split('T')[0]

  const releaseEntry = createChangelogEntry(version, {
    date: releaseDate,
    unreleased: false,
    compareUrl,
    sections: unreleased.sections,
  })

  const newEntries = [...changelog.entries]
  newEntries[unreleasedIndex] = releaseEntry

  return {
    ...changelog,
    entries: newEntries,
  }
}
