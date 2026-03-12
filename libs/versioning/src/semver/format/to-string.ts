import type { Range, Comparator } from '../models/range'
import type { SemVer } from '../models/version'

/**
 * Converts a SemVer to its canonical string representation.
 *
 * @param version - The version to format
 * @returns The version string (e.g., "1.2.3-alpha.1+build.123")
 */
export function format(version: SemVer): string {
  let result = `${version.major}.${version.minor}.${version.patch}`

  if (version.prerelease.length > 0) {
    result += '-' + version.prerelease.join('.')
  }

  if (version.build.length > 0) {
    result += '+' + version.build.join('.')
  }

  return result
}

/**
 * Converts a SemVer to a string without prerelease/build.
 *
 * @param version - The version to format
 * @returns The version string (e.g., "1.2.3")
 */
export function formatSimple(version: SemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`
}

/**
 * Converts a Range to its string representation.
 *
 * @param range - The range to format
 * @returns The range string
 */
export function formatRange(range: Range): string {
  if (range.raw) {
    return range.raw
  }

  if (range.sets.length === 0) {
    return '*'
  }

  return range.sets.map((set) => set.comparators.map((c) => formatComparator(c)).join(' ')).join(' || ')
}

/**
 * Converts a Comparator to its string representation.
 *
 * @param comparator - The comparator to format
 * @returns The comparator string (e.g., ">=1.0.0")
 */
export function formatComparator(comparator: Comparator): string {
  const op = comparator.operator === '=' ? '' : comparator.operator
  return op + format(comparator.version)
}
