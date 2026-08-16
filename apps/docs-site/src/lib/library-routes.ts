/**
 * Compute the docs-site route for a library from its generated-content slug
 * and category.
 *
 * Utils libraries live under the shared `/docs/libraries/utils/` umbrella and
 * drop their `-utils` suffix in the URL; every other library maps directly.
 *
 * @param slug - Generated-content slug (e.g. 'nexus', 'data-utils')
 * @param category - Library category from the docs manifest
 * @returns Site-relative route to the library's documentation page
 */
export function libraryRoute(slug: string, category: string): string {
  if (category === 'utils') {
    return `/docs/libraries/utils/${slug.replace('-utils', '')}`
  }
  return `/docs/libraries/${slug}`
}
