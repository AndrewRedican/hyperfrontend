import type { SemVer } from './version'

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
 * @example
 * ```typescript
 * createComparator('>=', parseVersionStrict('1.0.0'))
 * // => { operator: '>=', version: { major: 1, minor: 0, patch: 0, ... } }
 * ```
 */
export function createComparator(operator: RangeOperator, version: SemVer): Comparator {
  return { operator, version }
}

/**
 * Creates a new ComparatorSet.
 *
 * @param comparators - Array of comparators (AND logic)
 * @returns A new ComparatorSet
 *
 * @example
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
 * @example
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
 * @example
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
 * @example
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
 * @example
 * ```typescript
 * isWildcard(parseRangeStrict('*')) // => true
 * isWildcard(parseRangeStrict('^1.0.0')) // => false
 * ```
 */
export function isWildcard(range: Range): boolean {
  return range.sets.length === 0 || range.raw === '*' || range.raw === ''
}
