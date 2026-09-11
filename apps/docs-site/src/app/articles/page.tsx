import type { Metadata } from 'next'
import { ArticlesIndexList } from '@/components/articles/articles-index-list'
import { DocsChrome } from '@/components/docs-chrome'
import { getAllArticles } from '@/lib/articles'
import { ARTICLES_FEED_ALTERNATE } from '@/lib/metadata'

export const metadata: Metadata = {
  title: 'Articles',
  description: 'Long-form writing on microfrontend architecture, integration boundaries, and the reasoning behind hyperfrontend.',
  alternates: {
    canonical: '/articles/',
    types: ARTICLES_FEED_ALTERNATE,
  },
}

export default function ArticlesPage() {
  const articles = getAllArticles()

  return (
    <DocsChrome>
      <div className="max-w-5xl">
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Articles</h1>

        {articles.length === 0 ? (
          <p className="mt-12 text-slate-600 dark:text-slate-400">No articles published yet. Check back later.</p>
        ) : (
          <ArticlesIndexList
            articles={articles.map(({ slug, title, description, date, readingTime, heroImage, category, tags }) => ({
              slug,
              title,
              description,
              date,
              readingTime,
              heroImage,
              category,
              tags,
            }))}
          />
        )}
      </div>
    </DocsChrome>
  )
}
