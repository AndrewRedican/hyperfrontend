import type { ChangelogRelease } from './changelog-parse'
import { isRange, satisfiesRange } from './semver-range'

/** What a reader has asked the release history for. */
export interface ChangelogFilter {
  /** The words, ranges and versions typed into the one search box */
  query: string
  /** Earliest release day to show, `YYYY-MM-DD`, or empty for no lower bound */
  from: string
  /** Latest release day to show, `YYYY-MM-DD`, or empty for no upper bound */
  to: string
}

/** The empty filter: every release. */
export const NO_CHANGELOG_FILTER: ChangelogFilter = { query: '', from: '', to: '' }

/** The query, split into the two things it can carry. */
export interface ParsedQuery {
  /** Words to search the notes for, lower-cased, empty when the query is only versions */
  terms: string[]
  /** A semver range assembled from the query's version tokens, or null when it carries none */
  range: string | null
}

/**
 * Split a query into search words and a version range.
 *
 * One box, two readings. Whatever the whole query is a range (`^0.9`,
 * `>=0.8.0 <0.10.0`, `0.7.0 - 0.8.1`) it is taken as one and nothing is
 * searched for. Otherwise each token that reads as a version or a bound and
 * carries a digit (`0.9.0`, `^0.9`, `>=0.8`) becomes part of the range, and
 * every other token is a word to search the notes for, so `security ^0.9`
 * finds security notes in the 0.9 line. A word alone, however version-like
 * its letters, is a word.
 *
 * @param query - What was typed
 * @returns The words and the range
 *
 * @example
 * ```typescript
 * parseQuery('security ^0.9') // { terms: ['security'], range: '^0.9' }
 * parseQuery('0.7.0 - 0.8.1') // { terms: [], range: '0.7.0 - 0.8.1' }
 * parseQuery('heartbeat') // { terms: ['heartbeat'], range: null }
 * ```
 */
export function parseQuery(query: string): ParsedQuery {
  const trimmed = query.trim()
  if (trimmed === '') return { terms: [], range: null }
  if (/\d/.test(trimmed) && isRange(trimmed)) return { terms: [], range: trimmed }

  const terms: string[] = []
  const versions: string[] = []
  for (const token of trimmed.split(/\s+/)) {
    if (/\d/.test(token) && isRange(token)) versions.push(token)
    else terms.push(token.toLowerCase())
  }
  return { terms, range: versions.length === 0 ? null : versions.join(' ') }
}

/**
 * The text of a release a word search reads: its version, its headings, its
 * scopes and its notes, lower-cased and joined.
 *
 * @param release - The release being searched
 * @returns Everything a word can match against, lower-cased
 */
function searchableText(release: ChangelogRelease): string {
  const parts = [release.version]
  for (const section of release.sections) {
    parts.push(section.heading)
    if (section.kind === 'breaking') parts.push('breaking')
    for (const item of section.items) {
      parts.push(item.text)
      if (item.scope !== null) parts.push(item.scope)
      if (item.breaking) parts.push('breaking')
    }
  }
  return parts.join('\n').toLowerCase()
}

/**
 * Whether a release matches a parsed query.
 *
 * Every word must appear somewhere in the release, and the version must sit
 * inside the range when one was given.
 *
 * @param release - The release being tested
 * @param parsed - The query, split into words and a range
 * @returns True when the release is one the reader asked for
 */
function matchesQuery(release: ChangelogRelease, parsed: ParsedQuery): boolean {
  if (parsed.range !== null && !satisfiesRange(release.version, parsed.range)) return false
  if (parsed.terms.length === 0) return true
  const text = searchableText(release)
  return parsed.terms.every((term) => text.includes(term))
}

/**
 * Whether a release falls inside a day range.
 *
 * A release with no date is shown whatever the bounds are, because hiding it
 * would make an undated release impossible to find by date at all, and the
 * bounds are read as inclusive days.
 *
 * @param release - The release being tested
 * @param from - Earliest day allowed, or empty for none
 * @param to - Latest day allowed, or empty for none
 * @returns True when inside or undated
 */
function matchesDates(release: ChangelogRelease, from: string, to: string): boolean {
  if (release.date === null) return true
  if (from !== '' && release.date < from) return false
  if (to !== '' && release.date > to) return false
  return true
}

/**
 * Narrow a release history to what a filter asks for.
 *
 * The three axes combine: a word search, a version range and a day range
 * each drop what they exclude, and a release survives only when every axis
 * it is subject to lets it through. Order is kept, newest first.
 *
 * @param releases - The full history
 * @param filter - What the reader asked for
 * @returns The matching releases, in the history's order
 *
 * @example Security notes between two dates
 * ```typescript
 * filterReleases(releases, { query: 'security', from: '2026-08-01', to: '2026-09-30' })
 * ```
 */
export function filterReleases<T extends ChangelogRelease>(releases: readonly T[], filter: ChangelogFilter): T[] {
  const parsed = parseQuery(filter.query)
  return releases.filter((release) => matchesDates(release, filter.from, filter.to) && matchesQuery(release, parsed))
}

/**
 * Whether a filter narrows anything at all.
 *
 * @param filter - What the reader asked for
 * @returns True when any axis is set
 *
 * @example
 * ```typescript
 * isFiltering({ query: '', from: '', to: '' }) // false
 * ```
 */
export function isFiltering(filter: ChangelogFilter): boolean {
  return filter.query.trim() !== '' || filter.from !== '' || filter.to !== ''
}
