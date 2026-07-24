import type { NavItem } from '@/lib/navigation'
import type { MetadataRoute } from 'next'
import { getAllArticleSlugs } from '@/lib/articles'
import { docsNavigation, mainNavLinks } from '@/lib/navigation'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

export const dynamic = 'force-static'

const BASE_URL = 'https://hyperfrontend.dev'

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
  const staticPages = ['/', '/architecture', '/demos']

  const navUrls = extractUrls(docsNavigation)
  const mainUrls = mainNavLinks.map((link) => link.href)
  const articleUrls = getAllArticleSlugs().map((slug) => `/articles/${slug}`)

  const allUrls = [...createSet([...staticPages, ...navUrls, ...mainUrls, ...articleUrls])]

  return allUrls.map((url) => ({
    url: `${BASE_URL}${url}`,
    lastModified: createDate(),
    changeFrequency: url === '/' ? 'weekly' : 'monthly',
    priority: url === '/' ? 1.0 : url.startsWith('/docs/libraries') ? 0.8 : 0.6,
  }))
}
