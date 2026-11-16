import type { SemVer } from './version'
import { createSemVer } from './version'

/**
 * Comparison operator for version ranges.
 */
export type RangeOperator = '=' | '>' | '>=' | '<' | '<=' | '^' | '~'

/**
 * A single comparator in a range set.
 *
 * Examples:
 * - >=1.2.3 -> { operator: '>=', version: { major: 1, minor: 2, patch: 3 } }
 * - ^1.2.0 -> { operator: '^', version: { major: 1, minor: 2, patch: 0 } }
 */
export interface Comparator {
  /** The comparison operator */
  readonly operator: RangeOperator

  /** The version to compare against */
  readonly version: SemVer
}

/**
 * A set of comparators that must all be satisfied.
 * Represents the space-separated part of a range (AND logic).
 *
 * Example: ">=1.0.0 <2.0.0" -> two comparators in one set
 */
export interface ComparatorSet {
  /** Array of comparators that must all be satisfied (AND logic). */
  readonly comparators: readonly Comparator[]
}

/**
 * A version range that can contain multiple comparator sets.
 * Represents the || separated parts (OR logic).
 *
 * Example: "^1.0.0 || ^2.0.0" -> two comparator sets
 */
export interface Range {
  /** Comparator sets (OR logic between sets, AND logic within) */
  readonly sets: readonly ComparatorSet[]

  /** Original raw string if parsed */
  readonly raw?: string
}

/**
 * Creates a new Comparator.
 *
 * @param operator - The comparison operator
 * @param version - The version to compare against
 * @returns A new Comparator
 *
 * @example Create a comparator for version comparison
 * ```typescript
 * createComparator('>=', parseVersionStrict('1.0.0'))
 * // => { operator: '>=', version: { major: 1, minor: 0, patch: 0, ... } }
 * ```
 */
export function createComparator(operator: RangeOperator, version: SemVer): Comparator {
  return { operator, version }
}

/**
 * Gives the first version past everything a caret or tilde written on a version admits.
 *
 * A tilde holds the major and minor parts. A caret holds the leftmost non-zero part: the major
 * from 1.0.0 up, the minor below that, and the patch below 0.1.0.
 *
 * @param operator - The caret or tilde
 * @param version - The version the operator is written on
 * @returns The exclusive upper bound of the span
 *
 * @example Find where a caret or tilde span ends
 * ```typescript
 * ceilingOf('^', parseVersionStrict('1.2.3')) // => 2.0.0
 * ceilingOf('^', parseVersionStrict('0.2.3')) // => 0.3.0
 * ceilingOf('^', parseVersionStrict('0.0.3')) // => 0.0.4
 * ceilingOf('~', parseVersionStrict('1.2.3')) // => 1.3.0
 * ```
 */
export function ceilingOf(operator: '^' | '~', version: SemVer): SemVer {
  if (operator === '^' && version.major > 0) {
    return createSemVer({ major: version.major + 1, minor: 0, patch: 0 })
  }
  if (operator === '~' || version.minor > 0) {
    return createSemVer({ major: version.major, minor: version.minor + 1, patch: 0 })
  }
  return createSemVer({ major: version.major, minor: version.minor, patch: version.patch + 1 })
}

/**
 * Creates a new ComparatorSet.
 *
 * @param comparators - Array of comparators (AND logic)
 * @returns A new ComparatorSet
 *
 * @example Create a comparator set with AND logic
 * ```typescript
 * createComparatorSet([gte100, lt200]) // AND: >=1.0.0 AND <2.0.0
 * ```
 */
export function createComparatorSet(comparators: readonly Comparator[]): ComparatorSet {
  return { comparators }
}

/**
 * Creates a new Range.
 *
 * @param sets - Array of comparator sets (OR logic)
 * @param raw - Original raw string
 * @returns A new Range
 *
 * @example Create a range with OR logic between sets
 * ```typescript
 * createRange([set1, set2], '>=1.0.0 || >=2.0.0 <3.0.0')
 * ```
 */
export function createRange(sets: readonly ComparatorSet[], raw?: string): Range {
  return { sets, raw }
}

/**
 * Creates a range that matches any version.
 *
 * @returns A Range matching any version (*)
 *
 * @example Create a range that matches any version
 * ```typescript
 * const anyRange = createAnyRange()
 * satisfies(parseVersionStrict('999.999.999'), anyRange) // => true
 * ```
 */
export function createAnyRange(): Range {
  return createRange([], '*')
}

/**
 * Creates a range that matches exactly one version.
 *
 * @param version - The exact version to match
 * @returns A Range matching exactly the specified version
 *
 * @example Create a range that matches exactly one version
 * ```typescript
 * const exact = createExactRange(parseVersionStrict('1.2.3'))
 * satisfies(parseVersionStrict('1.2.3'), exact) // => true
 * satisfies(parseVersionStrict('1.2.4'), exact) // => false
 * ```
 */
export function createExactRange(version: SemVer): Range {
  return createRange([createComparatorSet([createComparator('=', version)])])
}

/**
 * Checks if a range represents a wildcard/any match.
 *
 * @param range - The range to check
 * @returns True if the range matches any version
 *
 * @example Check if a range represents a wildcard
 * ```typescript
 * isWildcard(parseRangeStrict('*')) // => true
 * isWildcard(parseRangeStrict('^1.0.0')) // => false
 * ```
 */
export function isWildcard(range: Range): boolean {
  return range.sets.length === 0 || range.raw === '*' || range.raw === ''
}
