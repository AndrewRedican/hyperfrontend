import type { GuideIndexEntry } from '../../scripts/generate-guides.types'
import { createURLSearchParams } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'

/**
 * The canonical route serving the guide and tutorial corpus. Every entry point
 * into filtered guides, on the site and in published package READMEs, resolves
 * here; there is no second guides destination.
 */
export const GUIDES_ROUTE = '/docs/guides/'

/** Query parameter naming the npm package a guides view is narrowed to. */
export const GUIDE_PACKAGE_PARAM = 'package'

/** Query parameter naming the document type a guides view is narrowed to. */
export const GUIDE_TYPE_PARAM = 'type'

/** The facet value meaning "do not narrow on this axis"; never serialized into a URL. */
export const GUIDE_FILTER_ALL = 'all'

/**
 * A guides view's two facets, as they appear in the URL.
 */
export interface GuideFilter {
  /** npm package name, or {@link GUIDE_FILTER_ALL} */
  package: string
  /** Diátaxis-aligned document type, or {@link GUIDE_FILTER_ALL} */
  type: string
}

/**
 * The unfiltered view: every guide, every type.
 */
export const NO_GUIDE_FILTER: GuideFilter = { package: GUIDE_FILTER_ALL, type: GUIDE_FILTER_ALL }

/**
 * Anything that can answer `get(name)` for a query parameter: the DOM
 * `URLSearchParams` and the App Router's `ReadonlyURLSearchParams` both do.
 */
export interface QueryParamSource {
  /**
   * Read one query parameter.
   *
   * @param name - Parameter name
   * @returns The value, or null when absent
   */
  get(name: string): string | null
}

/**
 * Build the canonical URL for a guides view.
 *
 * Facets left at {@link GUIDE_FILTER_ALL} (or omitted) are dropped rather than
 * serialized, so one view always has exactly one URL: the unfiltered index is
 * `/docs/guides/` and never `/docs/guides/?package=all`.
 *
 * @param filter - The facets to narrow to; omit for the unfiltered index
 * @returns Site-relative URL, with a query string only when a facet is active
 *
 * @example Link a package's README or docs page at its guides
 * ```ts
 * buildGuidesHref({ package: '@hyperfrontend/nexus' })
 * // '/docs/guides/?package=%40hyperfrontend%2Fnexus'
 * ```
 */
export function buildGuidesHref(filter: Partial<GuideFilter> = {}): string {
  const params = createURLSearchParams()
  if (filter.package && filter.package !== GUIDE_FILTER_ALL) {
    params.set(GUIDE_PACKAGE_PARAM, filter.package)
  }
  if (filter.type && filter.type !== GUIDE_FILTER_ALL) {
    params.set(GUIDE_TYPE_PARAM, filter.type)
  }
  const query = params.toString()
  return query ? `${GUIDES_ROUTE}?${query}` : GUIDES_ROUTE
}

/**
 * Read a guides view's facets out of a URL's query string.
 *
 * @param params - The query parameters of the current URL
 * @returns The facets, each falling back to {@link GUIDE_FILTER_ALL}
 */
export function readGuideFilter(params: QueryParamSource): GuideFilter {
  return {
    package: params.get(GUIDE_PACKAGE_PARAM) ?? GUIDE_FILTER_ALL,
    type: params.get(GUIDE_TYPE_PARAM) ?? GUIDE_FILTER_ALL,
  }
}

/**
 * Narrow a guide corpus to one view.
 *
 * A guide matches a package filter when it names that package anywhere in its
 * `packages` list, so a cross-cutting guide surfaces for every package it
 * involves. When a package is named, the guides primarily about it sort ahead
 * of the ones that merely involve it; otherwise the corpus keeps the index's
 * slug order.
 *
 * @param guides - The compiled guide corpus, or any subset of it
 * @param filter - The facets to narrow to
 * @returns The matching guides, ownership-first when a package is named
 */
export function filterGuides(guides: GuideIndexEntry[], filter: Partial<GuideFilter> = {}): GuideIndexEntry[] {
  const packageName = filter.package && filter.package !== GUIDE_FILTER_ALL ? filter.package : null
  const type = filter.type && filter.type !== GUIDE_FILTER_ALL ? filter.type : null

  const matching = guides.filter(
    (guide) => (packageName === null || guide.packages.includes(packageName)) && (type === null || guide.type === type)
  )

  if (packageName === null) {
    return matching
  }

  return [...matching].sort((a, b) => {
    const aOwns = a.packages[0] === packageName ? 0 : 1
    const bOwns = b.packages[0] === packageName ? 0 : 1
    return aOwns - bOwns || a.slug.localeCompare(b.slug)
  })
}
