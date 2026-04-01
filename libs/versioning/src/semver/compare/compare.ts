import type { Comparator, Range } from '../models/range'
import type { SemVer } from '../models/version'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/**
 * Compares two semantic versions.
 *
 * @param a - First version
 * @param b - Second version
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 *
 * @example
 * compare(parseVersion('1.0.0'), parseVersion('2.0.0')) // -1
 * compare(parseVersion('1.0.0'), parseVersion('1.0.0')) // 0
 * compare(parseVersion('2.0.0'), parseVersion('1.0.0')) // 1
 */
export function compare(a: SemVer, b: SemVer): -1 | 0 | 1 {
  if (a.major !== b.major) {
    return a.major < b.major ? -1 : 1
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor ? -1 : 1
  }
  if (a.patch !== b.patch) {
    return a.patch < b.patch ? -1 : 1
  }

  if (a.prerelease.length === 0 && b.prerelease.length > 0) {
    return 1
  }
  if (a.prerelease.length > 0 && b.prerelease.length === 0) {
    return -1
  }

  const maxLen = max(a.prerelease.length, b.prerelease.length)
  for (let i = 0; i < maxLen; i++) {
    const aId = a.prerelease[i]
    const bId = b.prerelease[i]

    if (aId === undefined && bId !== undefined) {
      return -1
    }
    if (aId !== undefined && bId === undefined) {
      return 1
    }
    if (aId === undefined || bId === undefined) {
      continue
    }

    const cmp = compareIdentifiers(aId, bId)
    if (cmp !== 0) {
      return cmp
    }
  }

  return 0
}

/**
 * Checks if two versions are equal (ignoring build metadata).
 *
 * @param a - First version
 * @param b - Second version
 * @returns True if versions are equal
 */
export function eq(a: SemVer, b: SemVer): boolean {
  return compare(a, b) === 0
}

/**
 * Checks if a < b.
 *
 * @param a - First version to compare
 * @param b - Second version to compare
 * @returns True if a is less than b
 */
export function lt(a: SemVer, b: SemVer): boolean {
  return compare(a, b) === -1
}

/**
 * Checks if a <= b.
 *
 * @param a - First version to compare
 * @param b - Second version to compare
 * @returns True if a is less than or equal to b
 */
export function lte(a: SemVer, b: SemVer): boolean {
  return compare(a, b) !== 1
}

/**
 * Checks if a > b.
 *
 * @param a - First version to compare
 * @param b - Second version to compare
 * @returns True if a is greater than b
 */
export function gt(a: SemVer, b: SemVer): boolean {
  return compare(a, b) === 1
}

/**
 * Checks if a >= b.
 *
 * @param a - First version to compare
 * @param b - Second version to compare
 * @returns True if a is greater than or equal to b
 */
export function gte(a: SemVer, b: SemVer): boolean {
  return compare(a, b) !== -1
}

/**
 * Checks if a != b.
 *
 * @param a - First version to compare
 * @param b - Second version to compare
 * @returns True if versions are not equal
 */
export function neq(a: SemVer, b: SemVer): boolean {
  return compare(a, b) !== 0
}

/**
 * Checks if a version satisfies a comparator.
 *
 * @param version - Version to check
 * @param comparator - Comparator to test against
 * @returns True if version satisfies the comparator
 */
export function satisfiesComparator(version: SemVer, comparator: Comparator): boolean {
  const cmp = compare(version, comparator.version)

  switch (comparator.operator) {
    case '=':
      return cmp === 0
    case '>':
      return cmp === 1
    case '>=':
      return cmp >= 0
    case '<':
      return cmp === -1
    case '<=':
      return cmp <= 0
    case '^':
    case '~':
      return cmp >= 0
    default:
      return false
  }
}

/**
 * Checks if a version satisfies a range.
 *
 * @param version - Version to check
 * @param range - Range to test against
 * @returns True if version satisfies the range
 *
 * @example
 * satisfies(parseVersion('1.2.3'), parseRange('^1.0.0')) // true
 * satisfies(parseVersion('2.0.0'), parseRange('^1.0.0')) // false
 */
export function satisfies(version: SemVer, range: Range): boolean {
  if (range.sets.length === 0) {
    return true
  }

  for (const set of range.sets) {
    let allSatisfied = true

    if (set.comparators.length === 0) {
      return true
    }

    for (const comp of set.comparators) {
      if (!satisfiesComparator(version, comp)) {
        allSatisfied = false
        break
      }
    }

    if (allSatisfied) {
      return true
    }
  }

  return false
}

/**
 * Finds the maximum version that satisfies a range.
 *
 * @param versions - Array of versions to check
 * @param range - Range to test against
 * @returns The maximum satisfying version, or null if none satisfy
 */
export function maxSatisfying(versions: readonly SemVer[], range: Range): SemVer | null {
  let max: SemVer | null = null

  for (const version of versions) {
    if (satisfies(version, range)) {
      if (max === null || gt(version, max)) {
        max = version
      }
    }
  }

  return max
}

/**
 * Finds the minimum version that satisfies a range.
 *
 * @param versions - Array of versions to check
 * @param range - Range to test against
 * @returns The minimum satisfying version, or null if none satisfy
 */
export function minSatisfying(versions: readonly SemVer[], range: Range): SemVer | null {
  let min: SemVer | null = null

  for (const version of versions) {
    if (satisfies(version, range)) {
      if (min === null || lt(version, min)) {
        min = version
      }
    }
  }

  return min
}

/**
 * Compares two prerelease identifiers.
 * Numeric identifiers have lower precedence than alphanumeric.
 * Numeric identifiers are compared numerically.
 * Alphanumeric identifiers are compared lexically.
 *
 * @param a - First prerelease identifier
 * @param b - Second prerelease identifier
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
function compareIdentifiers(a: string, b: string): -1 | 0 | 1 {
  const aIsNumeric = isNumeric(a)
  const bIsNumeric = isNumeric(b)

  if (aIsNumeric && !bIsNumeric) {
    return -1
  }
  if (!aIsNumeric && bIsNumeric) {
    return 1
  }

  if (aIsNumeric && bIsNumeric) {
    const aNum = parseInt(a, 10)
    const bNum = parseInt(b, 10)
    if (aNum < bNum) return -1
    if (aNum > bNum) return 1
    return 0
  }

  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Checks if a string consists only of digits.
 *
 * @param str - String to check for numeric content
 * @returns True if string contains only digits
 */
function isNumeric(str: string): boolean {
  if (str.length === 0) return false

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 48 || code > 57) {
      return false
    }
  }

  return true
}
