import type { NavItem } from '@/lib/navigation'
import type { MetadataRoute } from 'next'
import { getAllArticles } from '@/lib/articles'
import { getGuideIndex } from '@/lib/guides'
import { docsNavigation, mainNavLinks } from '@/lib/navigation'
import { SITE_URL } from '@/lib/site'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

export const dynamic = 'force-static'

/**
 * Recursively extract all href values from navigation items.
 *
 * @param items - Navigation items to extract URLs from
 * @returns Array of URL paths
 */
function extractUrls(items: NavItem[]): string[] {
  const urls: string[] = []

  for (const item of items) {
    if (item.href) {
      urls.push(item.href)
    }
    if (item.children) {
      urls.push(...extractUrls(item.children))
    }
  }

  return urls
}

/**
 * Generate sitemap.xml for search engine indexing.
 *
 * @returns Sitemap entries for all documented pages
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    '/',
    '/architecture',
    '/demos',
    '/privacy',
    // why: these pages exist but the sidebar navigation does not link them directly; validate-sitemap fails the build if one goes missing here
    '/docs/is-hyperfrontend-right-for-you',
    '/docs/libraries/utils',
    '/docs/libraries/network-protocol/channel',
    '/docs/libraries/network-protocol/data',
    '/docs/libraries/network-protocol/packet',
    '/docs/libraries/network-protocol/protocol',
    '/docs/libraries/network-protocol/receiver',
    '/docs/libraries/network-protocol/sender',
  ]

  const navUrls = extractUrls(docsNavigation)
  const mainUrls = mainNavLinks.map((link) => link.href)
  const articles = getAllArticles()
  const guides = getGuideIndex()
  const articleUrls = articles.map((article) => `/articles/${article.slug}`)
  const guideUrls = guides.map((guide) => guide.route)

  // why: A page's sitemap lastModified should reflect its content revision, not the build timestamp; a guide's is the day its examples were last run
  const contentDates = createMap([
    ...articles.map((article): [string, string] => [`/articles/${article.slug}`, article.updated || article.date]),
    ...guides.flatMap((guide): [string, string][] => (guide.verification.verifiedOn ? [[guide.route, guide.verification.verifiedOn]] : [])),
  ])

  const allUrls = [...createSet([...staticPages, ...navUrls, ...mainUrls, ...articleUrls, ...guideUrls])]

  return allUrls.map((url) => {
    const contentDate = contentDates.get(url)
    return {
      // why: trailingSlash is enabled site-wide, so sitemap locs must match the canonical trailing-slash form
      url: `${SITE_URL}${url.endsWith('/') ? url : `${url}/`}`,
      lastModified: contentDate ? createDate(contentDate) : createDate(),
      changeFrequency: url === '/' ? <const>'weekly' : <const>'monthly',
      priority: url === '/' ? 1.0 : url.startsWith('/docs/libraries') ? 0.8 : url.startsWith('/docs/guides/') ? 0.7 : 0.6,
    }
  })
}
