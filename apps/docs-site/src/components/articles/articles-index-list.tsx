'use client'

import type { FilterableArticle } from '@/lib/article-filters'
import { collectFilterTerms, filterArticles } from '@/lib/article-filters'
import { formatArticleDate } from '@/lib/article-format'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArticleFilter } from './article-filter'

/**
 * Serializable card data for one article on the index page.
 */
export interface ArticleCardData extends FilterableArticle {
  /** URL slug */
  slug: string
  /** Article title */
  title: string
  /** Short summary */
  description: string
  /** Human-readable reading time */
  readingTime: string
  /** Site-relative hero image path, empty when absent */
  heroImage: string
}

interface ArticlesIndexListProps {
  /** Articles, newest first */
  articles: ArticleCardData[]
}

/**
 * Article browser: newest-first cards with one filter above them.
 *
 * The filter is a single searchable multi-select over the categories and
 * tags the corpus carries, and every term chosen must match: selections
 * narrow, and the way to widen the list again is to take a term off. The
 * filter appears once the corpus is large enough for narrowing to mean
 * anything; a single article has nothing to be narrowed from.
 * @param props - Component props
 * @param props.articles - Articles, newest first
 * @returns The rendered article list
 */
export function ArticlesIndexList({ articles }: ArticlesIndexListProps) {
  const [selected, setSelected] = useState<string[]>([])

  const terms = useMemo(() => collectFilterTerms(articles), [articles])
  const visible = useMemo(() => filterArticles(articles, terms, selected), [articles, terms, selected])

  // why: with a single article, filters are noise; they appear once the corpus can actually be narrowed
  const showFilter = articles.length > 1 && terms.length > 1

  return (
    <div>
      {showFilter ? (
        <div className="mt-8">
          <ArticleFilter terms={terms} selected={selected} onChange={setSelected} />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-12 text-slate-600 dark:text-slate-400">No articles match every selected filter. Remove one to widen the list.</p>
      ) : (
        <div className="mt-12 grid gap-8">
          {visible.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Props for {@link ArticleCard}. */
interface ArticleCardProps {
  /** The article to draw */
  article: ArticleCardData
}

/**
 * One article on the index. The byline stays on the article itself; on the
 * index the date and the reading time are what a reader chooses by.
 * @param props - Component props
 * @param props.article - The article to draw
 * @returns The rendered card
 */
function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      {article.heroImage ? (
        <img src={article.heroImage} alt="" className="aspect-[2/1] w-full object-cover sm:aspect-[3/1]" loading="lazy" />
      ) : null}
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {article.category ? (
            <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
              {article.category}
            </span>
          ) : null}
          {article.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="mt-3 font-display text-2xl font-bold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
          {article.title}
        </h3>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{article.description}</p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
          {formatArticleDate(article.date)} · {article.readingTime}
        </p>
      </div>
    </Link>
  )
}
