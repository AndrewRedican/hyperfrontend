import type { Range } from '../../semver/models/range'
import type { SemVer } from '../../semver/models/version'
import type { Changelog } from '../models/changelog'
import type { ChangelogEntry } from '../models/entry'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { compare, satisfies } from '../../semver/compare/compare'
import { parseRange } from '../../semver/parse/range'
import { parseVersion } from '../../semver/parse/version'
import { filterEntries } from './filter-by-predicate'

/**
 * Filters entries by version range using semver.
 *
 * @param changelog - The changelog to filter
 * @param range - Semver range string (e.g., '>=1.0.0 <2.0.0')
 * @returns A new changelog with entries matching the range
 *
 * @example
 * ```ts
 * const majors = filterByVersionRange(changelog, '>=1.0.0 <2.0.0')
 * ```
 */
export function filterByVersionRange(changelog: Changelog, range: string): Changelog {
  const rangeResult = parseRange(range)

  if (!rangeResult.success) {
    throw createError(`Invalid version range: ${range}`)
  }

  const parsedRange = <Range>rangeResult.range

  return filterEntries(changelog, (entry) => {
    if (entry.unreleased) return false

    const versionResult = parseVersion(entry.version)
    if (!versionResult.version) return false

    return satisfies(versionResult.version, parsedRange)
  })
}

/**
 * Filters entries from a start version.
 *
 * @param changelog - The changelog to filter
 * @param startVersion - The minimum version (inclusive)
 * @returns A new changelog with entries >= startVersion
 */
export function filterFromVersion(changelog: Changelog, startVersion: string): Changelog {
  const startResult = parseVersion(startVersion)
  if (!startResult.success) {
    throw createError(`Invalid start version: ${startVersion}`)
  }

  const parsedStart = <SemVer>startResult.version

  return filterEntries(changelog, (entry) => {
    if (entry.unreleased) return true

    const versionResult = parseVersion(entry.version)
    if (!versionResult.version) return false

    return compare(versionResult.version, parsedStart) >= 0
  })
}

/**
 * Filters entries up to an end version.
 *
 * @param changelog - The changelog to apply the version filter to
 * @param endVersion - The maximum version (inclusive)
 * @returns A new changelog with entries <= endVersion
 */
export function filterToVersion(changelog: Changelog, endVersion: string): Changelog {
  const endResult = parseVersion(endVersion)
  if (!endResult.success) {
    throw createError(`Invalid end version: ${endVersion}`)
  }

  const parsedEnd = <SemVer>endResult.version

  return filterEntries(changelog, (entry) => {
    if (entry.unreleased) return false

    const versionResult = parseVersion(entry.version)
    if (!versionResult.version) return false

    return compare(versionResult.version, parsedEnd) <= 0
  })
}

/**
 * Gets entries within a version range (inclusive).
 *
 * @param changelog - The changelog to filter
 * @param startVersion - The minimum version (inclusive)
 * @param endVersion - The maximum version (inclusive)
 * @returns A new changelog with entries in the range
 */
export function filterVersionRange(changelog: Changelog, startVersion: string, endVersion: string): Changelog {
  const startResult = parseVersion(startVersion)
  const endResult = parseVersion(endVersion)

  if (!startResult.success) {
    throw createError(`Invalid start version: ${startVersion}`)
  }
  if (!endResult.success) {
    throw createError(`Invalid end version: ${endVersion}`)
  }

  const parsedStart = <SemVer>startResult.version
  const parsedEnd = <SemVer>endResult.version

  return filterEntries(changelog, (entry) => {
    if (entry.unreleased) return false

    const versionResult = parseVersion(entry.version)
    if (!versionResult.version) return false

    const cmpStart = compare(versionResult.version, parsedStart)
    const cmpEnd = compare(versionResult.version, parsedEnd)

    return cmpStart >= 0 && cmpEnd <= 0
  })
}

/**
 * Gets the N most recent entries.
 *
 * @param changelog - The changelog to filter
 * @param count - Number of entries to keep
 * @param includeUnreleased - Whether to include unreleased in count (default: false)
 * @returns A new changelog with only the most recent entries
 */
export function filterRecentEntries(changelog: Changelog, count: number, includeUnreleased = false): Changelog {
  if (count <= 0) {
    return { ...changelog, entries: [] }
  }

  const entries = includeUnreleased
    ? changelog.entries.slice(0, count)
    : (() => {
        const result: ChangelogEntry[] = []
        let remaining = count

        for (const entry of changelog.entries) {
          if (entry.unreleased) {
            result.push(entry)
          } else if (remaining > 0) {
            result.push(entry)
            remaining--
          }

          if (remaining <= 0 && !entry.unreleased) break
        }

        return result
      })()

  return { ...changelog, entries }
}

/**
 * Filters entries by release date.
 *
 * @param changelog - The changelog to filter
 * @param startDate - Start date (inclusive, ISO format)
 * @param endDate - End date (inclusive, ISO format)
 * @returns A new changelog with entries in the date range
 */
export function filterByDateRange(changelog: Changelog, startDate?: string, endDate?: string): Changelog {
  return filterEntries(changelog, (entry) => {
    if (!entry.date) return false

    if (startDate && entry.date < startDate) return false
    if (endDate && entry.date > endDate) return false

    return true
  })
}
