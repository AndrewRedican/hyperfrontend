import type { SemVer } from '../models/version'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSemVer } from '../models/version'

/**
 * Result of parsing a version string.
 */
export interface ParseVersionResult {
  /** Whether parsing succeeded */
  readonly success: boolean

  /** The parsed version (if successful) */
  readonly version?: SemVer

  /** Error message (if failed) */
  readonly error?: string
}

/**
 * Maximum version string length to prevent memory exhaustion.
 */
const MAX_VERSION_LENGTH = 256

/**
 * Parses a semantic version string.
 *
 * Accepts versions in the format: MAJOR.MINOR.PATCH[-prerelease][+build]
 * Optional leading 'v' or '=' prefixes are stripped.
 *
 * @param input - The version string to parse
 * @returns A ParseVersionResult with the parsed version or error
 *
 * @example
 * parseVersion('1.2.3') // { success: true, version: { major: 1, minor: 2, patch: 3, ... } }
 * parseVersion('v1.0.0-alpha.1+build.123') // { success: true, ... }
 * parseVersion('invalid') // { success: false, error: '...' }
 */
export function parseVersion(input: string): ParseVersionResult {
  // Input validation
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Version string is required' }
  }

  if (input.length > MAX_VERSION_LENGTH) {
    return { success: false, error: `Version string exceeds maximum length of ${MAX_VERSION_LENGTH}` }
  }

  // Strip leading whitespace
  let pos = 0
  while (pos < input.length && isWhitespace(input.charCodeAt(pos))) {
    pos++
  }

  // Strip trailing whitespace
  let end = input.length
  while (end > pos && isWhitespace(input.charCodeAt(end - 1))) {
    end--
  }

  // Strip optional leading 'v' or '='
  if (pos < end) {
    const code = input.charCodeAt(pos)
    if (code === 118 || code === 86) {
      // 'v' or 'V'
      pos++
    } else if (code === 61) {
      // '='
      pos++
    }
  }

  // Parse major version
  const majorResult = parseNumericIdentifier(input, pos, end)
  if (!majorResult.success) {
    return { success: false, error: majorResult.error ?? 'Invalid major version' }
  }
  pos = majorResult.endPos

  // Expect dot
  if (pos >= end || input.charCodeAt(pos) !== 46) {
    // '.'
    return { success: false, error: 'Expected "." after major version' }
  }
  pos++

  // Parse minor version
  const minorResult = parseNumericIdentifier(input, pos, end)
  if (!minorResult.success) {
    return { success: false, error: minorResult.error ?? 'Invalid minor version' }
  }
  pos = minorResult.endPos

  // Expect dot
  if (pos >= end || input.charCodeAt(pos) !== 46) {
    // '.'
    return { success: false, error: 'Expected "." after minor version' }
  }
  pos++

  // Parse patch version
  const patchResult = parseNumericIdentifier(input, pos, end)
  if (!patchResult.success) {
    return { success: false, error: patchResult.error ?? 'Invalid patch version' }
  }
  pos = patchResult.endPos

  // Parse optional prerelease
  const prerelease: string[] = []
  if (pos < end && input.charCodeAt(pos) === 45) {
    // '-'
    pos++
    const prereleaseResult = parseIdentifiers(input, pos, end, [43]) // Stop at '+'
    if (!prereleaseResult.success) {
      return { success: false, error: prereleaseResult.error ?? 'Invalid prerelease' }
    }
    prerelease.push(...prereleaseResult.identifiers)
    pos = prereleaseResult.endPos
  }

  // Parse optional build metadata
  const build: string[] = []
  if (pos < end && input.charCodeAt(pos) === 43) {
    // '+'
    pos++
    const buildResult = parseIdentifiers(input, pos, end, [])
    if (!buildResult.success) {
      return { success: false, error: buildResult.error ?? 'Invalid build metadata' }
    }
    build.push(...buildResult.identifiers)
    pos = buildResult.endPos
  }

  // Check for trailing characters
  if (pos < end) {
    return { success: false, error: `Unexpected character at position ${pos}: "${input[pos]}"` }
  }

  return {
    success: true,
    version: createSemVer({
      major: majorResult.value,
      minor: minorResult.value,
      patch: patchResult.value,
      prerelease,
      build,
      raw: input,
    }),
  }
}

/**
 * Parses a version string, throwing on invalid input.
 *
 * @param input - The version string to parse
 * @returns The parsed SemVer
 * @throws {Error} If the input is not a valid version
 */
export function parseVersionStrict(input: string): SemVer {
  const result = parseVersion(input)
  if (!result.success || !result.version) {
    throw createError(result.error ?? 'Invalid version')
  }
  return result.version
}

/**
 * Attempts to coerce a string into a valid semver.
 * More lenient than parseVersion - accepts partial versions.
 *
 * @param input - The string to coerce
 * @returns The parsed SemVer or null if coercion failed
 *
 * @example
 * coerceVersion('1') // { major: 1, minor: 0, patch: 0, ... }
 * coerceVersion('1.2') // { major: 1, minor: 2, patch: 0, ... }
 * coerceVersion('v2.0') // { major: 2, minor: 0, patch: 0, ... }
 */
export function coerceVersion(input: string): SemVer | null {
  if (!input || typeof input !== 'string') {
    return null
  }

  // Try strict parse first
  const strict = parseVersion(input)
  if (strict.success && strict.version) {
    return strict.version
  }

  // Strip leading/trailing whitespace
  let pos = 0
  while (pos < input.length && isWhitespace(input.charCodeAt(pos))) {
    pos++
  }

  let end = input.length
  while (end > pos && isWhitespace(input.charCodeAt(end - 1))) {
    end--
  }

  // Strip optional 'v' prefix
  if (pos < end) {
    const code = input.charCodeAt(pos)
    if (code === 118 || code === 86) {
      // 'v' or 'V'
      pos++
    }
  }

  // Parse major
  const majorResult = parseNumericIdentifier(input, pos, end)
  if (!majorResult.success) {
    return null
  }
  const major = majorResult.value
  pos = majorResult.endPos

  // Parse optional minor
  let minor = 0
  if (pos < end && input.charCodeAt(pos) === 46) {
    pos++
    const minorResult = parseNumericIdentifier(input, pos, end)
    if (minorResult.success) {
      minor = minorResult.value
      pos = minorResult.endPos
    }
  }

  // Parse optional patch
  let patch = 0
  if (pos < end && input.charCodeAt(pos) === 46) {
    pos++
    const patchResult = parseNumericIdentifier(input, pos, end)
    if (patchResult.success) {
      patch = patchResult.value
      // pos = patchResult.endPos // We ignore anything after patch in coerce
    }
  }

  return createSemVer({
    major,
    minor,
    patch,
    prerelease: [],
    build: [],
    raw: input,
  })
}

// ============================================================================
// Internal parsing helpers
// ============================================================================

interface NumericResult {
  success: boolean
  value: number
  endPos: number
  error?: string
}

/**
 * Parses a numeric identifier (non-negative integer, no leading zeros except for "0").
 *
 * @param input - Input string to parse
 * @param start - Start position in the input
 * @param end - End position in the input
 * @returns Numeric parsing result
 */
function parseNumericIdentifier(input: string, start: number, end: number): NumericResult {
  if (start >= end) {
    return { success: false, value: 0, endPos: start, error: 'Expected numeric identifier' }
  }

  let pos = start
  const firstCode = input.charCodeAt(pos)

  // Must start with a digit
  if (!isDigit(firstCode)) {
    return { success: false, value: 0, endPos: pos, error: 'Expected digit' }
  }

  // Check for leading zero (only "0" is valid, not "01", "007", etc.)
  if (firstCode === 48 && pos + 1 < end && isDigit(input.charCodeAt(pos + 1))) {
    return { success: false, value: 0, endPos: pos, error: 'Numeric identifier cannot have leading zeros' }
  }

  // Consume digits
  let value = 0
  while (pos < end && isDigit(input.charCodeAt(pos))) {
    value = value * 10 + (input.charCodeAt(pos) - 48)
    pos++

    // Prevent overflow
    if (value > Number.MAX_SAFE_INTEGER) {
      return { success: false, value: 0, endPos: pos, error: 'Numeric identifier is too large' }
    }
  }

  return { success: true, value, endPos: pos }
}

interface IdentifiersResult {
  success: boolean
  identifiers: string[]
  endPos: number
  error?: string
}

/**
 * Parses dot-separated identifiers (for prerelease/build).
 *
 * @param input - Input string to parse
 * @param start - Start position in the input
 * @param end - End position in the input
 * @param stopCodes - Character codes that signal end of identifiers
 * @returns Identifiers parsing result
 */
function parseIdentifiers(input: string, start: number, end: number, stopCodes: number[]): IdentifiersResult {
  const identifiers: string[] = []
  let pos = start

  while (pos < end) {
    // Check for stop characters
    if (stopCodes.includes(input.charCodeAt(pos))) {
      break
    }

    // Parse one identifier
    const identStart = pos
    while (pos < end) {
      const code = input.charCodeAt(pos)
      // Stop at dot or stop characters
      if (code === 46 || stopCodes.includes(code)) {
        break
      }
      // Must be alphanumeric or hyphen
      if (!isAlphanumeric(code) && code !== 45) {
        return { success: false, identifiers: [], endPos: pos, error: `Invalid character in identifier: "${input[pos]}"` }
      }
      pos++
    }

    // Empty identifier is not allowed
    if (pos === identStart) {
      return { success: false, identifiers: [], endPos: pos, error: 'Empty identifier' }
    }

    identifiers.push(input.slice(identStart, pos))

    // Consume dot separator
    if (pos < end && input.charCodeAt(pos) === 46) {
      pos++
      // Dot at end is invalid
      if (pos >= end || stopCodes.includes(input.charCodeAt(pos))) {
        return { success: false, identifiers: [], endPos: pos, error: 'Identifier expected after dot' }
      }
    }
  }

  return { success: true, identifiers, endPos: pos }
}

/**
 * Checks if a character code is a digit (0-9).
 *
 * @param code - Character code to check
 * @returns True if the code represents a digit
 */
function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}

/**
 * Checks if a character code is alphanumeric or hyphen.
 *
 * @param code - Character code to check
 * @returns True if the code represents an alphanumeric character
 */
function isAlphanumeric(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) // a-z
  )
}

/**
 * Checks if a character code is whitespace.
 *
 * @param code - Character code to check
 * @returns True if the code represents whitespace
 */
function isWhitespace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13
}
