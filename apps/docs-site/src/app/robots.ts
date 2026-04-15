import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

/**
 * Generate robots.txt allowing all crawlers.
 *
 * @returns Robots.txt configuration with sitemap reference
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://hyperfrontend.dev/sitemap.xml',
  }
}
