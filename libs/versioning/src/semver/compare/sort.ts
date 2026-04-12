import type { SemVer } from '../models/version'
import { compare } from './compare'

/**
 * Sorts an array of versions in ascending order.
 *
 * @param versions - Array of versions to sort
 * @returns A new sorted array
 *
 * @example Sort versions in ascending order
 * sort([v2, v1, v3]) // [v1, v2, v3]
 */
export function sort(versions: readonly SemVer[]): SemVer[] {
  return [...versions].sort(compare)
}

/**
 * Sorts an array of versions in descending order.
 *
 * @param versions - Array of versions to sort
 * @returns A new sorted array
 *
 * @example Sort versions in descending order
 * sortDescending([v1, v3, v2]) // [v3, v2, v1]
 */
export function sortDescending(versions: readonly SemVer[]): SemVer[] {
  return [...versions].sort((a, b) => compare(b, a))
}

/**
 * Returns the maximum version from an array.
 *
 * @param versions - Array of versions
 * @returns The maximum version, or null if array is empty
 *
 * @example Get the maximum version from an array
 * ```typescript
 * const versions = [parseVersionStrict('1.0.0'), parseVersionStrict('2.0.0')]
 * max(versions) // => { major: 2, minor: 0, patch: 0, ... }
 * max([]) // => null
 * ```
 */
export function max(versions: readonly SemVer[]): SemVer | null {
  if (versions.length === 0) return null

  let maxVer = <SemVer>versions[0]
  for (let i = 1; i < versions.length; i++) {
    if (compare(<SemVer>versions[i], maxVer) === 1) {
      maxVer = <SemVer>versions[i]
    }
  }

  return maxVer
}

/**
 * Returns the minimum version from an array.
 *
 * @param versions - Array of versions
 * @returns The minimum version, or null if array is empty
 *
 * @example Get the minimum version from an array
 * ```typescript
 * const versions = [parseVersionStrict('1.0.0'), parseVersionStrict('2.0.0')]
 * min(versions) // => { major: 1, minor: 0, patch: 0, ... }
 * min([]) // => null
 * ```
 */
export function min(versions: readonly SemVer[]): SemVer | null {
  if (versions.length === 0) return null

  let minVer = <SemVer>versions[0]
  for (let i = 1; i < versions.length; i++) {
    if (compare(<SemVer>versions[i], minVer) === -1) {
      minVer = <SemVer>versions[i]
    }
  }

  return minVer
}
