import type { Metadata } from 'next'
import { ArticlesIndexList } from '@/components/articles/articles-index-list'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
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
    <>
      <Header />
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Articles</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-400">
          Long-form writing on microfrontend architecture: the pressures that produce it, the boundaries that shape it, and the reasoning
          behind hyperfrontend. These pages are the canonical versions.
        </p>

        {articles.length === 0 ? (
          <p className="mt-12 text-slate-600 dark:text-slate-400">No articles published yet. Check back later.</p>
        ) : (
          <ArticlesIndexList
            articles={articles.map(({ slug, title, description, date, author, readingTime, heroImage, category, tags }) => ({
              slug,
              title,
              description,
              date,
              author,
              readingTime,
              heroImage,
              category,
              tags,
            }))}
          />
        )}
      </main>
      <Footer />
    </>
  )
}
