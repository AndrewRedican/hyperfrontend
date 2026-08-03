import type { Metadata } from 'next'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { formatArticleDate, getAllArticles } from '@/lib/articles'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Articles',
  description: 'Long-form writing on microfrontend architecture, integration boundaries, and the reasoning behind hyperfrontend.',
  alternates: {
    canonical: '/articles/',
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
          <div className="mt-12 grid gap-8">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                {article.heroImage ? (
                  <img src={article.heroImage} alt="" className="aspect-[2/1] w-full object-cover sm:aspect-[3/1]" loading="lazy" />
                ) : null}
                <div className="p-6 sm:p-8">
                  <h2 className="font-display text-2xl font-bold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {article.title}
                  </h2>
                  <p className="mt-3 text-slate-600 dark:text-slate-400">{article.description}</p>
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
                    {article.author} · {formatArticleDate(article.date)} · {article.readingTime}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
