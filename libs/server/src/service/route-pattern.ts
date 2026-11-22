import type { RouteParams } from './contract'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { create, freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * The params a route pattern declares: `{ id: string; rest: string }` for `'/a/:id/*rest'`.
 * A pattern that is not a literal gives the loose `RouteParams`.
 */
export type PathParams<Path extends string> = string extends Path
  ? RouteParams
  : Path extends `${infer Head}/${infer Tail}`
    ? PathParams<Head> & PathParams<Tail>
    : Path extends `:${infer Name}`
      ? { readonly [Key in Name]: string }
      : Path extends `*${infer Name}`
        ? { readonly [Key in Name]: string }
        : Readonly<Record<never, string>>

/** One segment of a parsed pattern. */
export interface PatternSegment {
  /** What the segment matches: one path segment equal to its text, any one non-empty path segment, or the rest of the path. */
  readonly kind: 'static' | 'param' | 'wildcard'
  /** The text a static segment equals, or the name a param or a wildcard is read under. */
  readonly text: string
}

/** A pattern split into its segments, in order. The root pattern has none. */
export type ParsedPattern = readonly PatternSegment[]

// note: The name of a param or a wildcard: an identifier, so that a handler reads it with a dot.
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

// note: The C0 controls, written as "nothing from the space upward" so that the expression itself holds no control character.
const C0_CONTROL = /[^ -\uffff]/

// note: What no decoded segment of a canonical path may hold besides the C0 controls: a backslash, the delete character and the C1 controls, the line and paragraph separators and the bidirectional controls.
const NEVER_IN_A_SEGMENT = /[\\\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/

// note: How specific each kind is when two patterns match one path; a pattern that has no segment at a position ranks last there.
const RANK = freeze({ static: 0, param: 1, wildcard: 2, none: 3 })

// note: The root pattern, which has no segment.
const ROOT: ParsedPattern = freeze([])

/**
 * Reports whether some canonical path can hold a static segment.
 *
 * @param text - The static segment as written.
 * @returns `false` for a dot segment and for text the listener refuses in every path.
 */
function canMatch(text: string): boolean {
  return text !== '.' && text !== '..' && !C0_CONTROL.test(text) && !NEVER_IN_A_SEGMENT.test(text)
}

/**
 * Parses one segment of a pattern.
 *
 * @param text - The segment as written, never empty.
 * @param earlier - The segments parsed to its left.
 * @param last - Whether it is the pattern's last segment.
 * @returns The parsed segment, or the problem line that names its fault.
 */
function parseSegment(text: string, earlier: readonly PatternSegment[], last: boolean): PatternSegment | string {
  const sigil = text[0]
  if (sigil !== ':' && sigil !== '*') {
    return canMatch(text) ? freeze({ kind: 'static', text }) : `segment ${earlier.length + 1} can never match a canonical path.`
  }
  const name = text.slice(1)
  // why: params are read from an object without a prototype, and a value stored under this one name would be dropped or become that prototype
  if (!NAME.test(name) || name === '__proto__') {
    return `segment ${earlier.length + 1} needs a name of letters, digits and "_", not starting with a digit.`
  }
  if (earlier.some((segment) => segment.kind !== 'static' && segment.text === name)) {
    return `the parameter "${name}" is declared twice.`
  }
  if (sigil === ':') {
    return freeze({ kind: 'param', text: name })
  }
  return last ? freeze({ kind: 'wildcard', text: name }) : 'a wildcard must be the last segment.'
}

/**
 * Parses a route pattern: `/`, or segments each led by a slash, where a segment is static text, `:name` for one path segment
 * or `*name`, last, for the rest of the path. Static text is written decoded and compared exactly. No regular expression is built from a pattern.
 *
 * @param pattern - The pattern as written; anything but a string is refused like a pattern without its leading slash.
 * @returns The frozen segments, or one problem line: the first structural fault, else the fault of the leftmost faulty segment.
 *
 * @example Parsing a pattern and refusing one
 * ```typescript
 * parsePattern('/tickets/:id/files/*rest')
 * // => [{ kind: 'static', text: 'tickets' }, { kind: 'param', text: 'id' }, { kind: 'static', text: 'files' }, { kind: 'wildcard', text: 'rest' }]
 * parsePattern('/tickets/') // 'the pattern must not end with "/".'
 * ```
 */
export function parsePattern(pattern: unknown): ParsedPattern | string {
  if (typeof pattern !== 'string' || !pattern.startsWith('/')) {
    return 'the pattern must start with "/".'
  }
  if (pattern === '/') {
    return ROOT
  }
  if (pattern.endsWith('/')) {
    return 'the pattern must not end with "/".'
  }
  const texts = pattern.slice(1).split('/')
  if (texts.includes('')) {
    return 'the pattern has an empty segment.'
  }
  const segments: PatternSegment[] = []
  for (const text of texts) {
    const segment = parseSegment(text, segments, segments.length === texts.length - 1)
    if (typeof segment === 'string') {
      return segment
    }
    segments.push(segment)
  }
  return freeze(segments)
}

/**
 * Matches the segments of a canonical path against a parsed pattern. Segments compare by code unit, case-sensitively;
 * a param takes one non-empty segment and a wildcard the remaining segments joined with slashes, at least one character.
 * A trailing slash is significant: only a wildcard matches a path that ends with one.
 *
 * @param pattern - The parsed pattern.
 * @param segments - The canonical path without its leading slash, split on slashes; the root path is one empty segment.
 * @returns The decoded values by name, in an object without a prototype, or `null` when the path does not match.
 *
 * @example Matching a path with a param and a wildcard
 * ```typescript
 * const pattern = parsePattern('/:tenant/*rest') as ParsedPattern
 * matchPattern(pattern, ['t1', 'x', 'y']) // { tenant: 't1', rest: 'x/y' }
 * matchPattern(pattern, ['t1']) // null
 * ```
 */
export function matchPattern(pattern: ParsedPattern, segments: readonly string[]): Record<string, string> | null {
  const params: Record<string, string> = create(null)
  if (pattern.length === 0) {
    // how: the root pattern has no segment, and the root path splits into one empty segment
    return segments.length === 1 && segments[0] === '' ? params : null
  }
  for (const [index, part] of pattern.entries()) {
    const segment = segments[index]
    if (part.kind === 'wildcard') {
      const rest = segments.slice(index).join('/')
      params[part.text] = rest
      return rest === '' ? null : params
    }
    if (part.kind === 'static' ? segment !== part.text : segment === undefined || segment === '') {
      return null
    }
    if (part.kind === 'param') {
      params[part.text] = segment as string
    }
  }
  return segments.length === pattern.length ? params : null
}

/**
 * Orders two patterns by how specific they are, whatever order a table lists them in: segment by segment from the left,
 * at the first position where their kinds differ a static segment comes before a param, and a param before a wildcard.
 * The static texts and the names are not compared, so two patterns of one shape tie.
 *
 * @param a - One parsed pattern.
 * @param b - Another parsed pattern.
 * @returns A negative number when the first is more specific, a positive one when the second is, and 0 for the same kinds throughout.
 *
 * @example Sorting candidates so that the most specific comes first
 * ```typescript
 * const candidates = [parsePattern('/*all'), parsePattern('/a/:x'), parsePattern('/a/b')] as ParsedPattern[]
 * candidates.sort(comparePatterns) // '/a/b', then '/a/:x', then '/*all'
 * ```
 */
export function comparePatterns(a: ParsedPattern, b: ParsedPattern): number {
  for (let index = 0; index < max(a.length, b.length); index += 1) {
    // note: patterns of unequal length match one path only when a wildcard sets them apart first, so ranking a missing segment last only keeps the order total
    const difference = RANK[a[index]?.kind ?? 'none'] - RANK[b[index]?.kind ?? 'none']
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

/**
 * Reports whether a value is a pattern made of static segments only, the kind a fixed path such as a probe's is written as.
 *
 * @param pattern - The value offered as a pattern.
 * @returns `true` for a valid pattern without a param or a wildcard, the root included.
 *
 * @example Telling a fixed path from a pattern with a param
 * ```typescript
 * isStaticPattern('/healthz') // true
 * isStaticPattern('/probe/:name') // false
 * isStaticPattern('/healthz/') // false
 * ```
 */
export function isStaticPattern(pattern: unknown): boolean {
  const parsed = parsePattern(pattern)
  return typeof parsed !== 'string' && parsed.every((segment) => segment.kind === 'static')
}
