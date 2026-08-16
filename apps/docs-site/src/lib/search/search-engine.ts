import type { SearchDocument, SearchDocumentKind } from './search-contract'

/**
 * One ranked search result.
 */
export interface SearchResult {
  /** Site-relative destination, including the anchor when the result targets a section */
  href: string
  /** Display title */
  title: string
  /** Document kind, for labeling */
  kind: SearchDocumentKind
  /** Context line: the parent document for section hits, or the document description */
  context?: string
  /** Deterministic relevance score (higher first) */
  score: number
}

/**
 * Ranking weights, in priority order. Scores are sums of the matched field
 * weights plus a small kind weight, so results are explainable: an exact
 * title match always beats a prefix match, which beats a contains match,
 * which beats keyword, section, package, and description matches, in that
 * order. Ties break alphabetically by destination.
 */
const WEIGHTS = {
  titleExact: 200,
  titlePrefix: 120,
  titleContains: 70,
  terms: 40,
  section: 35,
  package: 30,
  description: 10,
}

const KIND_WEIGHTS: Record<SearchDocumentKind, number> = {
  library: 8,
  guide: 7,
  page: 6,
  article: 5,
  architecture: 4,
  submodule: 3,
  api: 2,
}

/**
 * Normalize text for matching: lowercase, with every run of
 * non-alphanumeric characters collapsed to a single space.
 *
 * @param text - Raw text
 * @returns Normalized text
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Split a query into normalized tokens.
 *
 * @param query - Raw user query
 * @returns Normalized tokens; empty for a blank query
 */
export function tokenize(query: string): string[] {
  const normalized = normalize(query)
  return normalized ? normalized.split(' ') : []
}

/**
 * True when every token occurs somewhere in the haystack.
 *
 * @param haystack - Normalized text to search
 * @param tokens - Normalized query tokens
 * @returns Whether all tokens are present
 */
function containsAll(haystack: string, tokens: string[]): boolean {
  return tokens.every((token) => haystack.includes(token))
}

/**
 * Build the destination href for a document or section hit.
 *
 * @param url - Document route
 * @param anchor - Optional anchor
 * @returns Route with a trailing slash and optional fragment
 */
function toHref(url: string, anchor?: string): string {
  const withSlash = url.endsWith('/') ? url : `${url}/`
  return anchor ? `${withSlash}#${anchor}` : withSlash
}

/**
 * Search the index deterministically.
 *
 * Matching is exact substring over normalized text with AND semantics: every
 * query token must appear in the matched field (title, terms, package,
 * description, or a section title). There is no fuzziness; a result is either
 * matched by the reader's words or absent.
 *
 * @param documents - The loaded search documents
 * @param query - Raw user query
 * @param limit - Maximum results to return
 * @returns Ranked results, highest score first, ties alphabetical by destination
 */
export function search(documents: SearchDocument[], query: string, limit = 20): SearchResult[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) {
    return []
  }

  const joined = tokens.join(' ')
  const results: SearchResult[] = []

  for (const doc of documents) {
    const title = normalize(doc.title)
    const kindWeight = KIND_WEIGHTS[doc.kind]

    let docScore = 0
    if (title === joined) {
      docScore = WEIGHTS.titleExact
    } else if (title.startsWith(joined)) {
      docScore = WEIGHTS.titlePrefix
    } else if (containsAll(title, tokens)) {
      docScore = WEIGHTS.titleContains
    } else if (containsAll(normalize((doc.terms ?? []).join(' ')), tokens)) {
      docScore = WEIGHTS.terms
    } else if (doc.package && containsAll(normalize(doc.package), tokens)) {
      docScore = WEIGHTS.package
    } else if (doc.description && containsAll(normalize(doc.description), tokens)) {
      docScore = WEIGHTS.description
    }

    if (docScore > 0) {
      results.push({
        href: toHref(doc.url, doc.anchor),
        title: doc.title,
        kind: doc.kind,
        context: doc.kind === 'api' && doc.package ? doc.package : doc.description,
        score: docScore + kindWeight,
      })
    }

    for (const section of doc.sections ?? []) {
      if (containsAll(normalize(section.title), tokens)) {
        results.push({
          href: toHref(doc.url, section.anchor),
          title: section.title,
          kind: doc.kind,
          context: doc.title,
          score: WEIGHTS.section + kindWeight,
        })
      }
    }
  }

  results.sort((a, b) => b.score - a.score || a.href.localeCompare(b.href))

  const seen: Record<string, boolean> = {}
  const deduped: SearchResult[] = []
  for (const result of results) {
    if (seen[result.href]) continue
    seen[result.href] = true
    deduped.push(result)
    if (deduped.length >= limit) break
  }

  return deduped
}
