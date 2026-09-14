/** The canonical route of the downloads page, with the trailing slash the site uses. */
export const DOWNLOADS_ROUTE = '/docs/downloads/'

/** Query parameter naming the package a downloads view is focused on. */
export const DOWNLOADS_PACKAGE_PARAM = 'package'

/** The whole ecosystem's downloads, as much as a badge needs to say. */
export interface EcosystemDownloads {
  /** Raw npm downloads summed across every published package */
  total: number
  /** How many published packages the sum covers */
  packages: number
}

/**
 * Anything that can answer `get(name)` for a query parameter: the DOM
 * `URLSearchParams` and the App Router's `ReadonlyURLSearchParams` both do.
 */
export interface DownloadsQuerySource {
  /**
   * Read one query parameter.
   *
   * @param name - Parameter name
   * @returns The value, or null when absent
   */
  get(name: string): string | null
}

/**
 * The downloads page, focused on one package or on the whole ecosystem.
 *
 * Mirrors the guides index: the unfocused view has exactly one URL, and a
 * focused one carries the package under the same parameter name the guides
 * use, so a reader who has learned one has learned both.
 *
 * @param packageName - The package to focus, or nothing for the ecosystem view
 * @returns Site-relative URL, with a query string only when a package is named
 *
 * @example
 * ```typescript
 * buildDownloadsHref('@hyperfrontend/features') // '/docs/downloads/?package=%40hyperfrontend%2Ffeatures'
 * buildDownloadsHref() // '/docs/downloads/'
 * ```
 */
export function buildDownloadsHref(packageName?: string): string {
  if (!packageName) return DOWNLOADS_ROUTE
  return `${DOWNLOADS_ROUTE}?${DOWNLOADS_PACKAGE_PARAM}=${encodeURIComponent(packageName)}`
}

/**
 * Read the focused package out of a URL's query string.
 *
 * @param params - The query parameters of the current URL
 * @param known - The packages the page can focus; anything else is ignored rather than trusted
 * @returns The focused package, or null for the ecosystem view
 *
 * @example
 * ```typescript
 * readDownloadsFocus(createURLSearchParams('package=%40hyperfrontend%2Ffeatures'), ['@hyperfrontend/features'])
 * // '@hyperfrontend/features'
 * ```
 */
export function readDownloadsFocus(params: DownloadsQuerySource, known: readonly string[]): string | null {
  const requested = params.get(DOWNLOADS_PACKAGE_PARAM)
  return requested !== null && known.includes(requested) ? requested : null
}

/**
 * A download count in the compact form a pill has room for.
 *
 * Whole numbers below a thousand are written out; above it the count is
 * rounded to one decimal of the next unit, so 3,386 reads as 3.4K and
 * 1,204,000 as 1.2M. The exact figure belongs beside it, in a title or a
 * label, never dropped.
 *
 * @param count - The exact count
 * @returns The compact form
 *
 * @example
 * ```typescript
 * formatCompactCount(3386) // '3.4K'
 * formatCompactCount(842) // '842'
 * ```
 */
export function formatCompactCount(count: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count)
}

/**
 * A download count with thousands separators, for wherever the exact figure is shown.
 *
 * @param count - The figure to write out
 * @returns The figure with a separator every three digits
 *
 * @example
 * ```typescript
 * formatExactCount(3386) // '3,386'
 * ```
 */
export function formatExactCount(count: number): string {
  return new Intl.NumberFormat('en').format(count)
}
