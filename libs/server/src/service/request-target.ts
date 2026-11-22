import type { QueryView } from './contract'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createURLSearchParams } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'

/** A request target a service accepts, split in two. */
interface CanonicalTarget {
  /** The decoded path: a slash, then every segment decoded once and joined with slashes. */
  readonly path: string
  /** The query as sent, without its question mark; empty when the target has none. */
  readonly query: string
}

// note: Anything but visible ASCII. Node 18 hands a raw byte above 0x7F over as a Latin-1 unit, so one request would otherwise have two spellings of one path.
const RAW_UNIT_REFUSED = /[^!-~]/

// note: The C0 controls, written as "nothing from the space upward" so that the pattern itself holds no control character.
const C0_CONTROL = /[^ -\uffff]/

// note: Separators, the delete character and the C1 controls, the line and paragraph separators and the bidirectional controls: a path reaches the log, where each of these can forge or reorder a line.
const DECODED_UNIT_REFUSED = /[/\\\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/

/**
 * Decodes one raw path segment once.
 *
 * @param raw - The segment as sent, between two slashes.
 * @returns The decoded segment, or `null` for a percent escape that is malformed or is not UTF-8.
 */
function decodeSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

/**
 * Reports whether a decoded segment may be part of a canonical path.
 *
 * @param segment - The decoded segment, or `null` when it could not be decoded.
 * @param last - Whether the segment is the last one, the only place an empty segment may stand.
 * @returns `true` for a segment that needs no normalising and holds nothing a log line could be forged with.
 */
function isCanonicalSegment(segment: string | null, last: boolean): segment is string {
  if (segment === null || segment === '.' || segment === '..') {
    return false
  }
  return (segment !== '' || last) && !C0_CONTROL.test(segment) && !DECODED_UNIT_REFUSED.test(segment)
}

/**
 * Canonicalises a request target, or refuses it. The target must be in origin form and visible ASCII; its path is split
 * on slashes and every segment decoded once. Nothing is normalised: a dot segment, an empty interior segment, an encoded
 * separator, a control character, a line separator and a bidirectional control are all refused. A trailing slash is kept.
 *
 * @param url - The request target as Node hands it over.
 * @returns The canonical path and the raw query, or `null` for a target that is refused.
 *
 * @example Decoding a path and keeping its query raw
 * ```typescript
 * canonicalTarget('/tickets/a%20b?page=2') // { path: '/tickets/a b', query: 'page=2' }
 * canonicalTarget('/tickets/a%2Fb') // null
 * canonicalTarget('/tickets/../keys') // null
 * ```
 */
export function canonicalTarget(url: string): CanonicalTarget | null {
  if (!url.startsWith('/') || RAW_UNIT_REFUSED.test(url)) {
    return null
  }
  const queryAt = url.indexOf('?')
  const segments = (queryAt === -1 ? url : url.slice(0, queryAt)).slice(1).split('/').map(decodeSegment)
  if (!segments.every((segment, index) => isCanonicalSegment(segment, index === segments.length - 1))) {
    return null
  }
  // how: an empty first entry puts the leading slash in front of the joined segments
  return { path: ['', ...segments].join('/'), query: queryAt === -1 ? '' : url.slice(queryAt + 1) }
}

/**
 * Builds the read-only view of a query string a request carries. Names compare exactly and values are decoded;
 * a malformed escape reads as `URLSearchParams` reads it, so the view never fails.
 *
 * @param rawQuery - The query as sent, without its question mark.
 * @returns A frozen view with `get`, `getAll` and `has`.
 *
 * @example Reading a repeated name
 * ```typescript
 * const query = queryView('tag=a&tag=b+c')
 * query.get('tag') // 'a'
 * query.getAll('tag') // ['a', 'b c']
 * query.has('page') // false
 * ```
 */
export function queryView(rawQuery: string): QueryView {
  const params = createURLSearchParams(rawQuery)
  return freeze({
    get: (name: string) => params.get(name),
    getAll: (name: string) => params.getAll(name),
    has: (name: string) => params.has(name),
  })
}
