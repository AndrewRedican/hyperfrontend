import { parseInt as parseInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** A parsed version: three numbers and whatever prerelease tag followed them. */
export interface SemVer {
  /** Major */
  major: number
  /** Minor */
  minor: number
  /** Patch */
  patch: number
  /** Prerelease identifiers, empty for a stable release */
  prerelease: string[]
}

/** How one comparator relates a version to its bound. */
type Operator = '<' | '<=' | '>' | '>=' | '='

/** One bound of a range. */
interface Comparator {
  /** The relation */
  operator: Operator
  /** The bound */
  version: SemVer
}

/** A run of digits. */
const DIGITS = /^\d+$/

/** What a prerelease or build tag may be made of. */
const TAG_CHARACTERS = /^[0-9A-Za-z.-]+$/

/** The operators a comparator may open with, longest first so `>=` is read before `>`. */
const OPERATORS = ['>=', '<=', '>', '<', '=', '^', '~'] as const

/** The parts of a version as written, before they are read as numbers. */
interface VersionParts {
  /** The dotted core, `1.2.3` or `1.x`, without its `v` */
  core: string
  /** The prerelease tag after the first `-`, or empty */
  prerelease: string
}

/**
 * Split a version as written into its core and its tags.
 *
 * Done by hand rather than by one pattern: the prerelease tag and the build
 * tag share a character set and sit next to each other, which is exactly
 * the overlap a single expression backtracks over.
 *
 * @param text - The version as written
 * @returns The core and prerelease, or null when a tag is malformed
 */
function splitVersion(text: string): VersionParts | null {
  const trimmed = text.trim()
  const plus = trimmed.indexOf('+')
  const withoutBuild = plus === -1 ? trimmed : trimmed.slice(0, plus)
  if (plus !== -1 && !TAG_CHARACTERS.test(trimmed.slice(plus + 1))) return null
  const dash = withoutBuild.indexOf('-')
  const core = dash === -1 ? withoutBuild : withoutBuild.slice(0, dash)
  const prerelease = dash === -1 ? '' : withoutBuild.slice(dash + 1)
  if (prerelease !== '' && !TAG_CHARACTERS.test(prerelease)) return null
  if (dash !== -1 && prerelease === '') return null
  return { core: core.startsWith('v') ? core.slice(1) : core, prerelease }
}

/**
 * Parse a full version.
 *
 * @param text - `1.2.3`, `v1.2.3`, or `1.2.3-beta.1`
 * @returns The version, or null when the text is not one
 *
 * @example
 * ```typescript
 * parseVersion('v0.10.0') // { major: 0, minor: 10, patch: 0, prerelease: [] }
 * ```
 */
export function parseVersion(text: string): SemVer | null {
  const parts = splitVersion(text)
  if (parts === null) return null
  const numbers = parts.core.split('.')
  if (numbers.length !== 3 || !numbers.every((part) => DIGITS.test(part))) return null
  return {
    major: parseInteger(numbers[0], 10),
    minor: parseInteger(numbers[1], 10),
    patch: parseInteger(numbers[2], 10),
    prerelease: parts.prerelease === '' ? [] : parts.prerelease.split('.'),
  }
}

/**
 * Compare two prerelease tags the way semver orders them.
 *
 * @param a - One tag's identifiers
 * @param b - The other's
 * @returns Negative, zero or positive
 */
function comparePrerelease(a: string[], b: string[]): number {
  // why: a stable release ranks above any prerelease of the same triple
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  for (let index = 0; index < a.length && index < b.length; index += 1) {
    const left = a[index]
    const right = b[index]
    const leftNumber = /^\d+$/.test(left) ? parseInteger(left, 10) : null
    const rightNumber = /^\d+$/.test(right) ? parseInteger(right, 10) : null
    if (leftNumber !== null && rightNumber !== null) {
      if (leftNumber !== rightNumber) return leftNumber - rightNumber
    } else if (leftNumber !== null) {
      return -1
    } else if (rightNumber !== null) {
      return 1
    } else if (left !== right) {
      return left < right ? -1 : 1
    }
  }
  return a.length - b.length
}

/**
 * Order two versions.
 *
 * @param a - One version
 * @param b - The other
 * @returns Negative when `a` is lower, zero when equal, positive when higher
 *
 * @example
 * ```typescript
 * compareVersions(parseVersion('1.2.0'), parseVersion('1.10.0')) < 0 // true
 * ```
 */
export function compareVersions(a: SemVer, b: SemVer): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch || comparePrerelease(a.prerelease, b.prerelease)
}

/**
 * Whether a partial version part is a wildcard.
 *
 * @param part - `x`, `X`, `*`, a number, or undefined for an omitted part
 * @returns True for a wildcard or an omission
 */
function isWild(part: string | undefined): boolean {
  return part === undefined || part === 'x' || part === 'X' || part === '*'
}

/**
 * Whether a piece of a partial version is a number or a wildcard.
 *
 * @param piece - One dotted piece
 * @returns True for digits or a wildcard
 */
function isPiece(piece: string): boolean {
  return DIGITS.test(piece) || isWild(piece)
}

/**
 * Expand one comparator into the bounds it means.
 *
 * `^` and `~` and partial versions each stand for a span, so a single token
 * can produce two bounds: `^1.2.3` is `>=1.2.3 <2.0.0`, `1.2` is
 * `>=1.2.0 <1.3.0`, `*` is no bound at all.
 *
 * @param token - One comparator
 * @returns Its bounds, or null when the token is not a comparator
 */
function expandComparator(token: string): Comparator[] | null {
  const trimmed = token.trim()
  const operator = OPERATORS.find((candidate) => trimmed.startsWith(candidate)) ?? ''
  const parts = splitVersion(trimmed.slice(operator.length))
  if (parts === null || parts.core === '') return null
  const pieces = parts.core.split('.')
  if (pieces.length > 3 || !pieces.every(isPiece)) return null

  const [majorPart, minorPart, patchPart] = pieces
  if (isWild(majorPart)) return []
  const major = parseInteger(majorPart, 10)
  const minorWild = isWild(minorPart)
  const patchWild = isWild(patchPart)
  const minor = minorWild ? 0 : parseInteger(minorPart, 10)
  const patch = patchWild ? 0 : parseInteger(patchPart, 10)
  const prerelease = parts.prerelease === '' ? [] : parts.prerelease.split('.')
  const floor: SemVer = { major, minor, patch, prerelease }

  if (operator === '^' || (operator === '' && (minorWild || patchWild))) {
    // why: a caret keeps the leftmost non-zero part fixed, and a partial version keeps its written parts fixed
    let ceiling: SemVer
    if (operator === '^' && major > 0) ceiling = { major: major + 1, minor: 0, patch: 0, prerelease: [] }
    else if (operator === '^' && minor > 0) ceiling = { major, minor: minor + 1, patch: 0, prerelease: [] }
    else if (operator === '^' && !patchWild) ceiling = { major, minor, patch: patch + 1, prerelease: [] }
    else if (minorWild) ceiling = { major: major + 1, minor: 0, patch: 0, prerelease: [] }
    else ceiling = { major, minor: minor + 1, patch: 0, prerelease: [] }
    return [
      { operator: '>=', version: floor },
      { operator: '<', version: ceiling },
    ]
  }
  if (operator === '~') {
    const ceiling: SemVer = minorWild
      ? { major: major + 1, minor: 0, patch: 0, prerelease: [] }
      : { major, minor: minor + 1, patch: 0, prerelease: [] }
    return [
      { operator: '>=', version: floor },
      { operator: '<', version: ceiling },
    ]
  }
  if (operator === '' || operator === '=') return [{ operator: '=', version: floor }]
  if ((operator === '>' || operator === '<=') && (minorWild || patchWild)) {
    // why: `>1.2` means past every 1.2.x, and `<=1.2` means up to and including all of them
    const ceiling: SemVer = minorWild
      ? { major: major + 1, minor: 0, patch: 0, prerelease: [] }
      : { major, minor: minor + 1, patch: 0, prerelease: [] }
    return [{ operator: operator === '>' ? '>=' : '<', version: ceiling }]
  }
  return [{ operator, version: floor }]
}

/**
 * Whether a version satisfies one bound.
 *
 * @param version - The version being tested
 * @param comparator - The bound it is tested against
 * @returns True when the relation holds
 */
function satisfiesComparator(version: SemVer, comparator: Comparator): boolean {
  const order = compareVersions(version, comparator.version)
  switch (comparator.operator) {
    case '<':
      return order < 0
    case '<=':
      return order <= 0
    case '>':
      return order > 0
    case '>=':
      return order >= 0
    case '=':
      return order === 0
  }
}

/**
 * Parse a range into alternatives, each a conjunction of bounds.
 *
 * Understands what a reader would type into a filter: a bare version, a
 * partial version (`1`, `1.2`, `1.x`), `^` and `~`, the comparison operators,
 * a hyphen range (`1.0.0 - 2.0.0`), space-joined conjunctions and `||`
 * alternatives.
 *
 * @param text - The range as typed
 * @returns The alternatives, or null when any part of the text is not a range
 */
function parseRange(text: string): Comparator[][] | null {
  const alternatives: Comparator[][] = []
  for (const alternative of text.split('||')) {
    const hyphen = /^\s*(\S+)\s+-\s+(\S+)\s*$/.exec(alternative)
    const tokens =
      hyphen === null
        ? alternative
            .trim()
            .split(/\s+/)
            .filter((token) => token !== '')
        : [`>=${hyphen[1]}`, `<=${hyphen[2]}`]
    if (tokens.length === 0) return null
    const bounds: Comparator[] = []
    for (const token of tokens) {
      const expanded = expandComparator(token)
      if (expanded === null) return null
      bounds.push(...expanded)
    }
    alternatives.push(bounds)
  }
  return alternatives
}

/**
 * Whether text is a range this matcher understands.
 *
 * @param text - The range as typed
 * @returns True when it parses
 *
 * @example
 * ```typescript
 * isRange('^1.2') // true
 * isRange('security') // false
 * ```
 */
export function isRange(text: string): boolean {
  return parseRange(text) !== null
}

/**
 * Whether a version falls inside a range.
 *
 * A prerelease version satisfies a bound only when the bound itself names a
 * prerelease of the same triple, the rule npm applies, so `^1.0.0` does not
 * pull in `2.0.0-beta.1`.
 *
 * @param version - The version as written, `0.10.0`
 * @param range - The range as typed, `^0.9`, `>=0.8.0 <0.10.0`, `0.7.0 - 0.8.1`
 * @returns True when the version is inside; false when either does not parse
 *
 * @example
 * ```typescript
 * satisfiesRange('0.9.0', '^0.9') // true
 * satisfiesRange('0.10.0', '^0.9') // false
 * satisfiesRange('1.5.0', '1.0.0 - 2.0.0') // true
 * ```
 */
export function satisfiesRange(version: string, range: string): boolean {
  const parsed = parseVersion(version)
  const alternatives = parseRange(range)
  if (parsed === null || alternatives === null) return false
  return alternatives.some((bounds) => {
    if (!bounds.every((bound) => satisfiesComparator(parsed, bound))) return false
    if (parsed.prerelease.length === 0) return true
    return bounds.some(
      (bound) =>
        bound.version.prerelease.length > 0 &&
        bound.version.major === parsed.major &&
        bound.version.minor === parsed.minor &&
        bound.version.patch === parsed.patch
    )
  })
}
