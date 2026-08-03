import type { Metadata } from 'next'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { ReadmeContent } from '@/components/readme-content'
import { formatArticleDate, getAllArticleSlugs, getArticle } from '@/lib/articles'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/**
 * Route parameters for an article page.
 */
interface ArticleRouteParams {
  /** Article slug from the URL */
  slug: string
}

type ArticlePageProps = { params: Promise<ArticleRouteParams> }

export function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)

  if (!article) {
    return { title: 'Article Not Found' }
  }

  return {
    title: article.title,
    description: article.description,
    authors: [{ name: article.author }],
    alternates: {
      canonical: `/articles/${article.slug}/`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `/articles/${article.slug}/`,
      siteName: 'HyperFrontend',
      type: 'article',
      publishedTime: article.date,
      authors: [article.author],
      images: article.heroImage ? [{ url: article.heroImage }] : [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      images: article.heroImage ? [article.heroImage] : [DEFAULT_TWITTER_IMAGE],
    },
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = getArticle(slug)

  if (!article) {
    notFound()
  }

  const { processedContent, diagrams } = extractMermaidBlocks(article.content)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Header />
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm">
          <Link href="/articles" className="text-primary-600 hover:underline dark:text-primary-400">
            ← All articles
          </Link>
        </nav>

        <header className="mb-10">
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">{article.title}</h1>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {article.author} · {formatArticleDate(article.date)} · {article.readingTime}
          </p>
          {article.mediumUrl || article.hackernoonUrl ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This is the canonical version. Also published on{' '}
              {article.mediumUrl ? (
                <a
                  href={article.mediumUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline dark:text-primary-400"
                >
                  Medium
                </a>
              ) : null}
              {article.mediumUrl && article.hackernoonUrl ? ' and ' : null}
              {article.hackernoonUrl ? (
                <a
                  href={article.hackernoonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline dark:text-primary-400"
                >
                  Hackernoon
                </a>
              ) : null}
              .
            </p>
          ) : null}
        </header>

        {/* why: Narrow article images do not fill the prose column; center them instead of the default left alignment */}
        <div className="[&_img]:mx-auto">
          <ReadmeContent html={html} mermaidDiagrams={diagrams} />
        </div>
      </main>
      <Footer />
    </>
  )
}
