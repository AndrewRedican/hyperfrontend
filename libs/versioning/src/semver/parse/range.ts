import type { Comparator, ComparatorSet, Range, RangeOperator } from '../models/range'
import type { SemVer } from '../models/version'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { globalIsNaN, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createComparator, createComparatorSet, createRange } from '../models/range'
import { createSemVer } from '../models/version'

/**
 * Result of parsing a range string.
 */
export interface ParseRangeResult {
  /** Whether parsing succeeded */
  readonly success: boolean

  /** The parsed range (if successful) */
  readonly range?: Range

  /** Error message (if failed) */
  readonly error?: string
}

/**
 * Maximum range string length.
 */
const MAX_RANGE_LENGTH = 1024

/**
 * Parses a semver range string.
 *
 * Supports:
 * - Exact: 1.2.3, =1.2.3
 * - Comparators: >1.0.0, >=1.0.0, <2.0.0, <=2.0.0
 * - Caret: ^1.2.3 (compatible with version)
 * - Tilde: ~1.2.3 (approximately equivalent)
 * - X-ranges: 1.x, 1.2.x, *
 * - Hyphen ranges: 1.0.0 - 2.0.0
 * - OR: 1.0.0 || 2.0.0
 * - AND: >=1.0.0 <2.0.0
 *
 * @param input - The range string to parse
 * @returns A ParseRangeResult with the parsed range or error
 *
 * @example Parse semver range strings
 * ```typescript
 * parseRange('^1.0.0') // => { success: true, range: ... }
 * parseRange('>=1.0.0 <2.0.0') // => { success: true, range: ... }
 * parseRange('1.0.0 || 2.0.0') // => { success: true, range: ... }
 * ```
 */
export function parseRange(input: string): ParseRangeResult {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Range string is required' }
  }

  if (input.length > MAX_RANGE_LENGTH) {
    return { success: false, error: `Range string exceeds maximum length of ${MAX_RANGE_LENGTH}` }
  }

  const trimmed = input.trim()

  if (trimmed === '' || trimmed === '*' || trimmed.toLowerCase() === 'x') {
    return { success: true, range: createRange([], input) }
  }

  const orParts = splitByOr(trimmed)
  const sets: ComparatorSet[] = []

  for (const part of orParts) {
    const setResult = parseComparatorSet(part.trim())
    if (!setResult.success) {
      return { success: false, error: setResult.error }
    }
    if (setResult.set) {
      sets.push(setResult.set)
    }
  }

  return { success: true, range: createRange(sets, input) }
}

/**
 * Parses a range string, throwing on invalid input.
 *
 * @param input - The range string to parse
 * @returns The parsed Range
 * @throws {Error} If the input is not a valid range
 *
 * @example Parse range with strict validation
 * ```typescript
 * const range = parseRangeStrict('^1.0.0')
 * parseRangeStrict('invalid range!!!') // throws Error
 * ```
 */
export function parseRangeStrict(input: string): Range {
  const result = parseRange(input)
  if (!result.success || !result.range) {
    throw createError(result.error ?? 'Invalid range')
  }
  return result.range
}

/** Result of parsing a comparator set */
interface SetResult {
  /** Whether parsing succeeded */
  success: boolean
  /** The parsed comparator set (if successful) */
  set?: ComparatorSet
  /** Error message (if failed) */
  error?: string
}

/**
 * Splits a string by || delimiter, respecting nesting.
 *
 * @param input - Range string containing OR groups
 * @returns Array of OR-separated parts
 */
function splitByOr(input: string): string[] {
  const parts: string[] = []
  let current = ''
  let pos = 0

  while (pos < input.length) {
    if (input[pos] === '|' && pos + 1 < input.length && input[pos + 1] === '|') {
      parts.push(current)
      current = ''
      pos += 2
    } else {
      current += input[pos]
      pos++
    }
  }

  parts.push(current)
  return parts
}

/**
 * Parses a single comparator set (space-separated comparators = AND logic).
 *
 * @param input - Comparator set string
 * @returns Parsed set result
 */
function parseComparatorSet(input: string): SetResult {
  if (!input || input.trim() === '') {
    return { success: true }
  }

  const trimmed = input.trim()

  const hyphenMatch = parseHyphenRange(trimmed)
  if (hyphenMatch.isHyphenRange) {
    if (!hyphenMatch.success) {
      return { success: false, error: hyphenMatch.error }
    }
    return { success: true, set: hyphenMatch.set }
  }

  const tokens = splitByWhitespace(trimmed)
  const comparators: Comparator[] = []

  for (const token of tokens) {
    const compResult = parseSingleComparator(token)
    if (!compResult.success) {
      return { success: false, error: compResult.error }
    }
    if (compResult.comparators) {
      comparators.push(...compResult.comparators)
    }
  }

  if (comparators.length === 0) {
    return { success: true }
  }

  return { success: true, set: createComparatorSet(comparators) }
}

/** Result of parsing a hyphen range */
interface HyphenResult {
  /** Whether input was a hyphen range */
  isHyphenRange: boolean
  /** Whether parsing succeeded */
  success: boolean
  /** The parsed comparator set (if successful) */
  set?: ComparatorSet
  /** Error message (if failed) */
  error?: string
}

/**
 * Checks for and parses hyphen ranges like "1.0.0 - 2.0.0".
 *
 * @param input - Potential hyphen range string
 * @returns Hyphen range parsing result
 */
function parseHyphenRange(input: string): HyphenResult {
  let hyphenPos = -1

  for (let i = 0; i < input.length - 2; i++) {
    if (input[i] === ' ' && input[i + 1] === '-' && input[i + 2] === ' ') {
      hyphenPos = i
      break
    }
  }

  if (hyphenPos === -1) {
    return { isHyphenRange: false, success: true }
  }

  const leftPart = input.slice(0, hyphenPos).trim()
  const rightPart = input.slice(hyphenPos + 3).trim()

  const leftVersion = parseSimpleVersion(leftPart)
  if (!leftVersion) {
    return { isHyphenRange: true, success: false, error: `Invalid left side of hyphen range: "${leftPart}"` }
  }

  const rightVersion = parseSimpleVersion(rightPart)
  if (!rightVersion) {
    return { isHyphenRange: true, success: false, error: `Invalid right side of hyphen range: "${rightPart}"` }
  }

  const comparators: Comparator[] = [createComparator('>=', leftVersion), createComparator('<=', rightVersion)]

  return {
    isHyphenRange: true,
    success: true,
    set: createComparatorSet(comparators),
  }
}

/**
 * Splits by whitespace.
 *
 * @param input - String to split
 * @returns Array of whitespace-separated tokens
 */
function splitByWhitespace(input: string): string[] {
  const tokens: string[] = []
  let current = ''

  for (const char of input) {
    if (char === ' ' || char === '\t') {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

/** Result of parsing a single comparator */
interface ComparatorResult {
  /** Whether parsing succeeded */
  success: boolean
  /** The parsed comparators (if successful) */
  comparators?: Comparator[]
  /** Error message (if failed) */
  error?: string
}

/**
 * Parses a single comparator token (e.g., ">=1.0.0", "^1.2.3", "~1.0").
 *
 * @param token - Comparator token to parse
 * @returns Parsed comparator result
 */
function parseSingleComparator(token: string): ComparatorResult {
  let pos = 0
  let operator: RangeOperator = '='

  if (token[pos] === '^') {
    operator = '^'
    pos++
  } else if (token[pos] === '~') {
    operator = '~'
    pos++
  } else if (token[pos] === '>') {
    if (token[pos + 1] === '=') {
      operator = '>='
      pos += 2
    } else {
      operator = '>'
      pos++
    }
  } else if (token[pos] === '<') {
    if (token[pos + 1] === '=') {
      operator = '<='
      pos += 2
    } else {
      operator = '<'
      pos++
    }
  } else if (token[pos] === '=') {
    operator = '='
    pos++
  }

  const versionPart = token.slice(pos)

  if (versionPart === '*' || versionPart.toLowerCase() === 'x') {
    return { success: true, comparators: [] }
  }

  if (versionPart.includes('x') || versionPart.includes('X') || versionPart.includes('*')) {
    return parseXRange(versionPart, operator)
  }

  const version = parseSimpleVersion(versionPart)
  if (!version) {
    return { success: false, error: `Invalid version in comparator: "${versionPart}"` }
  }

  if (operator === '^') {
    return expandCaretRange(version)
  }

  if (operator === '~') {
    return expandTildeRange(version)
  }

  return { success: true, comparators: [createComparator(operator, version)] }
}

/**
 * Parses x-ranges like 1.x, 1.2.x, etc.
 *
 * @param input - X-range string to parse
 * @param _operator - Range operator (unused but kept for interface consistency)
 * @returns Comparator result
 */
function parseXRange(input: string, _operator: RangeOperator): ComparatorResult {
  void _operator
  const parts = input.split('.')
  const nums: number[] = []

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'x' || lower === '*' || lower === '') {
      break
    }
    const num = parseInt(part, 10)
    if (globalIsNaN(num) || num < 0) {
      return { success: false, error: `Invalid x-range: "${input}"` }
    }
    nums.push(num)
  }

  if (nums.length === 0) {
    return { success: true, comparators: [] }
  }

  if (nums.length === 1) {
    const lower = createSemVer({ major: <number>nums[0], minor: 0, patch: 0 })
    const upper = createSemVer({ major: <number>nums[0] + 1, minor: 0, patch: 0 })
    return { success: true, comparators: [createComparator('>=', lower), createComparator('<', upper)] }
  }

  const lower = createSemVer({ major: <number>nums[0], minor: <number>nums[1], patch: 0 })
  const upper = createSemVer({ major: <number>nums[0], minor: <number>nums[1] + 1, patch: 0 })
  return { success: true, comparators: [createComparator('>=', lower), createComparator('<', upper)] }
}

/**
 * Expands caret range: ^1.2.3 -> >=1.2.3 <2.0.0
 *
 * @param version - Base version for caret range
 * @returns Expanded comparator result
 */
function expandCaretRange(version: SemVer): ComparatorResult {
  let upperMajor = version.major
  let upperMinor = 0
  let upperPatch = 0

  if (version.major === 0) {
    if (version.minor === 0) {
      upperPatch = version.patch + 1
      upperMinor = version.minor
    } else {
      upperMinor = version.minor + 1
    }
  } else {
    upperMajor = version.major + 1
  }

  const upper = createSemVer({ major: upperMajor, minor: upperMinor, patch: upperPatch })
  return { success: true, comparators: [createComparator('>=', version), createComparator('<', upper)] }
}

/**
 * Expands tilde range: ~1.2.3 -> >=1.2.3 <1.3.0
 *
 * @param version - Base version for tilde range
 * @returns Expanded comparator result
 */
function expandTildeRange(version: SemVer): ComparatorResult {
  const upper = createSemVer({
    major: version.major,
    minor: version.minor + 1,
    patch: 0,
  })

  return { success: true, comparators: [createComparator('>=', version), createComparator('<', upper)] }
}

/**
 * Parses a simple version string (no range operators).
 * More lenient - accepts partial versions.
 *
 * @param input - Version string to parse
 * @returns Parsed SemVer or null if invalid
 */
function parseSimpleVersion(input: string): SemVer | null {
  if (!input) return null

  let pos = 0

  if (input[pos] === 'v' || input[pos] === 'V') {
    pos++
  }

  const parts = input.slice(pos).split('.')
  if (parts.length === 0) return null

  const nums: number[] = []
  for (const part of parts) {
    const dashIdx = part.indexOf('-')
    const plusIdx = part.indexOf('+')
    let numPart = part

    if (dashIdx !== -1) {
      numPart = part.slice(0, dashIdx)
    } else if (plusIdx !== -1) {
      numPart = part.slice(0, plusIdx)
    }

    if (numPart === '' || numPart.toLowerCase() === 'x' || numPart === '*') {
      break
    }

    const num = parseInt(numPart, 10)
    if (globalIsNaN(num) || num < 0) return null
    nums.push(num)
  }

  if (nums.length === 0) return null

  return createSemVer({
    major: <number>nums[0],
    minor: nums[1] ?? 0,
    patch: nums[2] ?? 0,
    prerelease: [],
    build: [],
    raw: input,
  })
}
