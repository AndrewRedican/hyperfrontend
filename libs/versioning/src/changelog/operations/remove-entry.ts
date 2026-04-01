import type { Changelog } from '../models/changelog'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Options for removing an entry.
 */
export interface RemoveEntryOptions {
  /** Throw error if entry not found (default: true) */
  readonly throwIfNotFound?: boolean
}

/**
 * Removes an entry from a changelog by version.
 *
 * @param changelog - The changelog to remove from
 * @param version - The version to remove
 * @param options - Optional removal options
 * @returns A new changelog without the specified entry
 *
 * @example
 * ```ts
 * const newChangelog = removeEntry(changelog, '1.0.0')
 * ```
 */
export function removeEntry(changelog: Changelog, version: string, options?: RemoveEntryOptions): Changelog {
  const throwIfNotFound = options?.throwIfNotFound ?? true
  const entryIndex = changelog.entries.findIndex((e) => e.version === version)

  if (entryIndex === -1) {
    if (throwIfNotFound) {
      throw createError(`Entry with version "${version}" not found`)
    }
    return changelog
  }

  const newEntries = [...changelog.entries]
  newEntries.splice(entryIndex, 1)

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Removes multiple entries from a changelog.
 *
 * @param changelog - The changelog to remove from
 * @param versions - The versions to remove
 * @param options - Optional removal options
 * @returns A new changelog without the specified entries
 */
export function removeEntries(changelog: Changelog, versions: readonly string[], options?: RemoveEntryOptions): Changelog {
  const versionsSet = createSet(versions)
  const newEntries = changelog.entries.filter((e) => !versionsSet.has(e.version))

  if (options?.throwIfNotFound !== false) {
    const removedVersions = changelog.entries.filter((e) => versionsSet.has(e.version)).map((e) => e.version)
    const notFoundVersions = versions.filter((v) => !removedVersions.includes(v))

    if (notFoundVersions.length > 0) {
      throw createError(`Entries not found for versions: ${notFoundVersions.join(', ')}`)
    }
  }

  return {
    ...changelog,
    entries: newEntries,
  }
}

/**
 * Removes the unreleased entry if it exists.
 *
 * @param changelog - The changelog to remove the unreleased entry from
 * @param options - Optional removal options
 * @returns A new changelog without the unreleased entry
 */
export function removeUnreleased(changelog: Changelog, options?: RemoveEntryOptions): Changelog {
  const unreleasedIndex = changelog.entries.findIndex((e) => e.unreleased)

  if (unreleasedIndex === -1) {
    if (options?.throwIfNotFound ?? true) {
      throw createError('No unreleased entry found')
    }
    return changelog
  }

  const newEntries = [...changelog.entries]
  newEntries.splice(unreleasedIndex, 1)

  return {
    ...changelog,
    entries: newEntries,
  }
}
