import type { Metadata } from 'next'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { ReadmeContent } from '@/components/readme-content'
import { formatArticleDate, getAllArticleSlugs, getArticle } from '@/lib/articles'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata'
import { ShareMenu } from '@/components/share/share-menu'
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
    keywords: [...article.tags, ...article.packages],
    openGraph: {
      title: article.title,
      description: article.description,
      url: `/articles/${article.slug}/`,
      siteName: 'HyperFrontend',
      type: 'article',
      publishedTime: article.date,
      modifiedTime: article.updated || undefined,
      authors: [article.author],
      tags: article.tags.length > 0 ? article.tags : undefined,
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

  const relatedArticles = article.related.map((relatedSlug) => {
    const related = getArticle(relatedSlug)
    if (!related) {
      // why: A dangling related slug would silently vanish from the page; failing the static build surfaces the authoring error instead
      throw new Error(`article '${article.slug}' lists unknown related article '${relatedSlug}'`)
    }
    return related
  })

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
          {article.category || article.tags.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {article.category ? (
                <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
                  {article.category}
                </span>
              ) : null}
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">{article.title}</h1>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {article.author} · {formatArticleDate(article.date)} · {article.readingTime}
              {article.updated ? ` · Updated ${formatArticleDate(article.updated)}` : ''}
            </p>
            <ShareMenu path={`/articles/${article.slug}/`} title={article.title} pageLine={article.description} />
          </div>
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

        {relatedArticles.length > 0 ? (
          <section className="mt-16 border-t border-slate-200 pt-8 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Related reading</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {relatedArticles.map((related) => (
                <Link
                  key={related.slug}
                  href={`/articles/${related.slug}`}
                  className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
                >
                  <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {related.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{related.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  )
}
