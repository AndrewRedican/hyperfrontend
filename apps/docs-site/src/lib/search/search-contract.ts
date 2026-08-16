/**
 * @module search-contract
 *
 * The serialized search-index contract.
 *
 * This file is the boundary between whatever produces the index and the
 * search UI that consumes it. Today `scripts/generate-search-index.ts`
 * compiles the index from the docs generation outputs; a future
 * `@hyperfrontend/indexer` package can replace that producer wholesale, as
 * long as it emits this shape. The consumer depends on nothing but this
 * contract and the `/search-index.json` location.
 *
 * Contract guarantees:
 * - Deterministic: identical content produces byte-identical output
 *   (documents sorted by url, then anchor, then title; no timestamps).
 * - Static: a single JSON file served from the site root, fetched lazily.
 * - Addressable: every entry names a real route. Section anchors are derived
 *   with the same algorithm the pages use to assign heading ids
 *   (`src/lib/slug.ts`), so a section link resolves wherever that algorithm is
 *   the one in play; anchors are not verified against rendered HTML.
 */

/** Kinds of documents the index can point at. */
export type SearchDocumentKind = 'page' | 'library' | 'submodule' | 'architecture' | 'guide' | 'article' | 'api'

/**
 * One addressable search target.
 */
export interface SearchDocument {
  /** Site-relative route (no fragment, no trailing slash required) */
  url: string
  /** Optional anchor on that route (e.g. 'api-createBroker') */
  anchor?: string
  /** Display title */
  title: string
  /** What this document is; drives result labeling and ranking tiebreaks */
  kind: SearchDocumentKind
  /** Short context line shown under the result title */
  description?: string
  /** Owning npm package, where applicable */
  package?: string
  /** Additional match terms (keywords, tags, aliases) */
  terms?: string[]
  /** Addressable page sections, in document order */
  sections?: SearchDocumentSection[]
}

/**
 * A section of a document, addressable by anchor.
 */
export interface SearchDocumentSection {
  /** Plain section heading text */
  title: string
  /** Anchor id the heading carries on the rendered page */
  anchor: string
}

/**
 * The serialized search index.
 */
export interface SearchIndex {
  /** Contract version; consumers must reject versions they do not understand */
  schemaVersion: 1
  /** Every addressable document, sorted by url, anchor, title */
  documents: SearchDocument[]
}

/** Where the serialized index is served from, relative to the site root. */
export const SEARCH_INDEX_PATH = '/search-index.json'
