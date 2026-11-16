import type { Comparator, ComparatorSet, Range, RangeOperator } from '../models/range'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { MAX_SAFE_INTEGER } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { ceilingOf, createComparator, createComparatorSet, createRange } from '../models/range'
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

/** The operators a comparator may open with, longest first so `>=` is read before `>`. */
const OPERATORS: readonly RangeOperator[] = ['>=', '<=', '>', '<', '=', '^', '~']

/**
 * Parses a semver range string, reading it the way npm does.
 *
 * Supports:
 * - Exact: 1.2.3, =1.2.3
 * - Comparators: >1.0.0, >=1.0.0, <2.0.0, <=2.0.0, with or without a space after the operator
 * - Caret: ^1.2.3 (compatible with version)
 * - Tilde: ~1.2.3 (approximately equivalent)
 * - X-ranges: 1.x, 1.2.x, *
 * - Partial versions: 1 and 1.2, which stand for the same spans as 1.x and 1.2.x
 * - Hyphen ranges: 1.0.0 - 2.0.0
 * - OR: 1.0.0 || 2.0.0
 * - AND: >=1.0.0 <2.0.0
 *
 * A part left out or written as a wildcard stands for every value it could take, under every
 * operator: `18` admits all of 18, `~1` admits all of 1, `>1.2` starts at 1.3.0, `<=1.2` ends
 * before 1.3.0 and `1.0.0 - 2` ends before 3.0.0. A range with an alternative that admits any
 * version, such as `* || 1.2.3`, is the wildcard.
 *
 * @param input - The range string to parse
 * @returns A ParseRangeResult with the parsed range or error
 *
 * @example Parse semver range strings
 * ```typescript
 * parseRange('^1.0.0') // => { success: true, range: ... }
 * parseRange('>=1.0.0 <2.0.0') // => { success: true, range: ... }
 * parseRange('1.0.0 || 2.0.0') // => { success: true, range: ... }
 * parseRange('18 || 20') // => { success: true, range: ... } admitting 18.3.1 and 20.11.0
 * ```
 */
export function parseRange(input: string): ParseRangeResult {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Range string is required' }
  }

  if (input.length > MAX_RANGE_LENGTH) {
    return { success: false, error: `Range string exceeds maximum length of ${MAX_RANGE_LENGTH}` }
  }

  const sets: ComparatorSet[] = []

  for (const part of splitByOr(input)) {
    const setResult = parseComparatorSet(part.trim())
    if (setResult.success === false) {
      return { success: false, error: setResult.error }
    }
    sets.push(setResult.set)
  }

  // why: one alternative admitting any version makes the whole range the wildcard, which the model writes as no sets at all
  return { success: true, range: createRange(sets.some((set) => set.comparators.length === 0) ? [] : sets, input) }
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

/** A comparator set that parsed. */
interface ParsedSet {
  /** Marks the text as a comparator set */
  readonly success: true
  /** The comparators the text stands for, none when it admits any version */
  readonly set: ComparatorSet
}

/** Text that is not a comparator set. */
interface RejectedSet {
  /** Marks the text as rejected */
  readonly success: false
  /** Why the text was rejected */
  readonly error: string
}

/**
 * Splits a range into its alternatives at each `||`.
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
 * @returns The comparators it stands for, or why it is not a comparator set
 */
function parseComparatorSet(input: string): ParsedSet | RejectedSet {
  const tokens = joinOperators(splitByWhitespace(input))

  // why: a hyphen range is the whole alternative, so a lone hyphen anywhere else falls through and is rejected as a comparator
  if (tokens.length === 3 && tokens[1] === '-') {
    return parseHyphenRange(tokens[0] as string, tokens[2] as string)
  }

  const comparators: Comparator[] = []

  for (const token of tokens) {
    const operator = OPERATORS.find((candidate) => token.startsWith(candidate))
    const versionPart = operator === undefined ? token : token.slice(operator.length)
    const partial = parsePartialVersion(versionPart)
    if (partial === null) {
      return { success: false, error: `Invalid version in comparator: "${versionPart}"` }
    }
    comparators.push(...expandComparator(operator ?? '=', partial))
  }

  return { success: true, set: createComparatorSet(comparators) }
}

/**
 * Parses the two sides of a hyphen range like "1.0.0 - 2.0.0".
 *
 * The left side is a lower bound and the right side an upper bound, so a partial right side
 * reaches to the end of what it stands for: `1.0.0 - 2` ends before 3.0.0.
 *
 * @param left - The version text before the hyphen
 * @param right - The version text after the hyphen
 * @returns The comparators the range stands for, or which side is not a version
 */
function parseHyphenRange(left: string, right: string): ParsedSet | RejectedSet {
  const lower = parsePartialVersion(left)
  if (lower === null) {
    return { success: false, error: `Invalid left side of hyphen range: "${left}"` }
  }

  const upper = parsePartialVersion(right)
  if (upper === null) {
    return { success: false, error: `Invalid right side of hyphen range: "${right}"` }
  }

  return { success: true, set: createComparatorSet([...expandComparator('>=', lower), ...expandComparator('<=', upper)]) }
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
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
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

/**
 * Joins an operator written apart from its version, as in ">= 1.2.3", into one comparator token.
 *
 * @param tokens - Whitespace-separated tokens of a comparator set
 * @returns The tokens with every lone operator prefixed to the token after it
 */
function joinOperators(tokens: readonly string[]): string[] {
  const joined: string[] = []
  let pending = ''

  for (const token of tokens) {
    if (OPERATORS.includes(token as RangeOperator)) {
      pending += token
    } else {
      joined.push(pending + token)
      pending = ''
    }
  }

  // why: an operator with no version after it stays a token of its own, so it is rejected instead of dropped
  if (pending) {
    joined.push(pending)
  }

  return joined
}

/** A comparator's version as written, before the parts it leaves open are given a meaning. */
interface PartialVersion {
  /** The numeric parts written before the first omitted or wildcard part: none for `*`, one for `1` or `1.x`, three for `1.2.3` */
  readonly known: readonly number[]
  /** Prerelease identifiers, which only a version with all three parts may carry */
  readonly prerelease: readonly string[]
  /** Build identifiers, which say nothing about precedence */
  readonly build: readonly string[]
  /** The text as written */
  readonly raw: string
}

/**
 * Gives a comparator the bounds it stands for.
 *
 * A version with all three parts is compared as written. A partial version stands for a span,
 * every version sharing its written parts, and the operator decides which edge of that span is
 * the bound: `>1.2` is past the whole span (`>=1.3.0`) and `<=1.2` is up to its end (`<1.3.0`).
 *
 * @param operator - How the comparator relates a version to its bound
 * @param partial - The comparator's version as written
 * @returns The bounds, none when the comparator admits any version
 */
function expandComparator(operator: RangeOperator, partial: PartialVersion): Comparator[] {
  const [major, minor, patch] = partial.known

  if (major === undefined) {
    // why: no version sorts before or after every version, so a strict comparison against a wildcard admits none; the lowest prerelease of 0.0.0 has nothing below it
    return operator === '>' || operator === '<'
      ? [createComparator('<', createSemVer({ major: 0, minor: 0, patch: 0, prerelease: ['0'] }))]
      : []
  }

  if (minor !== undefined && patch !== undefined) {
    const version = createSemVer({ major, minor, patch, prerelease: partial.prerelease, build: partial.build, raw: partial.raw })
    return operator === '^' || operator === '~'
      ? [createComparator('>=', version), createComparator('<', ceilingOf(operator, version))]
      : [createComparator(operator, version)]
  }

  const nextMajor = createSemVer({ major: major + 1, minor: 0, patch: 0 })
  const floor = createSemVer({ major, minor: minor ?? 0, patch: 0 })
  const ceiling = minor === undefined ? nextMajor : createSemVer({ major, minor: minor + 1, patch: 0 })

  switch (operator) {
    case '>':
      return [createComparator('>=', ceiling)]
    case '>=':
      return [createComparator('>=', floor)]
    case '<':
      return [createComparator('<', floor)]
    case '<=':
      return [createComparator('<', ceiling)]
    case '^':
      // why: a caret holds the leftmost non-zero part, so above 0.x a written minor still leaves the whole major open
      return [createComparator('>=', floor), createComparator('<', major > 0 ? nextMajor : ceiling)]
    default:
      return [createComparator('>=', floor), createComparator('<', ceiling)]
  }
}

/**
 * Reads a comparator's version: one to three dot-separated parts, each a number or a wildcard
 * (`x`, `X` or `*`), behind an optional `v`. Prerelease and build identifiers are kept, so a
 * comparator such as `>=1.0.0-alpha.6` compares against the prerelease rather than `1.0.0`.
 *
 * @param input - Version text with no operator
 * @returns The version as written, or null if the text is not one
 */
function parsePartialVersion(input: string): PartialVersion | null {
  const text = input[0] === 'v' || input[0] === 'V' ? input.slice(1) : input
  const plusIdx = text.indexOf('+')
  const withoutBuild = plusIdx === -1 ? text : text.slice(0, plusIdx)
  const dashIdx = withoutBuild.indexOf('-')

  const prerelease = dashIdx === -1 ? [] : parseIdentifierList(withoutBuild.slice(dashIdx + 1))
  if (prerelease === null) return null

  const build = plusIdx === -1 ? [] : parseIdentifierList(text.slice(plusIdx + 1))
  if (build === null) return null

  const parts = (dashIdx === -1 ? withoutBuild : withoutBuild.slice(0, dashIdx)).split('.')
  if (parts.length > 3) return null

  const known: number[] = []
  let open = false
  for (const part of parts) {
    if (part === 'x' || part === 'X' || part === '*') {
      open = true
      continue
    }

    const value = parseNumericPart(part)
    if (value === null) return null
    // why: a part written after a wildcard is checked but carries no meaning, 1.x.3 being 1.x
    if (!open) known.push(value)
  }

  // why: a prerelease qualifies one exact version, so a version with a part left open cannot carry one
  if (known.length < 3 && dashIdx !== -1) return null

  return { known, prerelease, build, raw: input }
}

/**
 * Reads one numeric part of a version: digits only, no leading zero, within the safe integer range.
 *
 * @param part - The text between two dots
 * @returns The number, or null if the text is not a valid numeric part
 */
function parseNumericPart(part: string): number | null {
  if (part === '' || (part.length > 1 && part[0] === '0')) return null

  let value = 0
  for (let i = 0; i < part.length; i++) {
    const code = part.charCodeAt(i)
    if (code < 48 || code > 57) return null

    value = value * 10 + (code - 48)
    if (value > MAX_SAFE_INTEGER) return null
  }

  return value
}

/**
 * Splits dot-separated prerelease or build identifiers.
 * Every identifier must be non-empty and made of ASCII letters, digits and hyphens.
 *
 * @param text - The text after the `-` or `+` separator
 * @returns The identifiers, or null if any identifier is invalid
 */
function parseIdentifierList(text: string): string[] | null {
  const identifiers = text.split('.')

  for (const identifier of identifiers) {
    if (identifier === '') return null

    for (let i = 0; i < identifier.length; i++) {
      const code = identifier.charCodeAt(i)
      const isAlphanumeric = (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
      if (!isAlphanumeric && code !== 45) return null
    }
  }

  return identifiers
}
