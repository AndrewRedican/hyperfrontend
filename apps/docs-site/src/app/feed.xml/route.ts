import { getAllArticles } from '@/lib/articles'
import { buildArticlesFeed } from '@/lib/feed'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

/**
 * Serve the Articles Atom feed, generated at build time.
 *
 * @returns The Atom XML response
 */
export function GET(): Response {
  return new Response(buildArticlesFeed(getAllArticles(), SITE_URL), {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  })
}
