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
 * @example Filtering by semver range
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
 *
 * @example Filtering from a start version
 * ```typescript
 * const recent = filterFromVersion(changelog, '2.0.0')
 * // Only entries for version 2.0.0 and later
 * ```
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
 *
 * @example Filtering to an end version
 * ```typescript
 * const legacy = filterToVersion(changelog, '1.9.9')
 * // Only entries for versions up to 1.9.9
 * ```
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
 *
 * @example Filtering entries within a version range
 * ```typescript
 * const range = filterVersionRange(changelog, '1.5.0', '2.0.0')
 * // Entries from 1.5.0 through 2.0.0
 * ```
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
 *
 * @example Getting the most recent entries
 * ```typescript
 * const latest = filterRecentEntries(changelog, 5)
 * // Last 5 released versions (plus unreleased if present)
 * ```
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
 *
 * @example Filtering entries by date range
 * ```typescript
 * const q1 = filterByDateRange(changelog, '2024-01-01', '2024-03-31')
 * // Entries released in Q1 2024
 * ```
 */
export function filterByDateRange(changelog: Changelog, startDate?: string, endDate?: string): Changelog {
  return filterEntries(changelog, (entry) => {
    if (!entry.date) return false

    if (startDate && entry.date < startDate) return false
    if (endDate && entry.date > endDate) return false

    return true
  })
}
