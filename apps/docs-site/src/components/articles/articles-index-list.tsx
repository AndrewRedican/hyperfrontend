'use client'

import { formatArticleDate } from '@/lib/article-format'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Serializable card data for one article on the index page.
 */
export interface ArticleCardData {
  /** URL slug */
  slug: string
  /** Article title */
  title: string
  /** Short summary */
  description: string
  /** Publication date in YYYY-MM-DD format */
  date: string
  /** Author display name */
  author: string
  /** Human-readable reading time */
  readingTime: string
  /** Site-relative hero image path, empty when absent */
  heroImage: string
  /** Content category, empty when uncategorized */
  category: string
  /** Discovery tags */
  tags: string[]
}

interface ArticlesIndexListProps {
  /** Articles, newest first */
  articles: ArticleCardData[]
}

/**
 * Article browser: newest-first cards, filterable by category and tag once
 * the corpus is large enough for filters to help.
 * @param props - Component props
 * @param props.articles - Articles, newest first
 * @returns The rendered article list
 */
export function ArticlesIndexList({ articles }: ArticlesIndexListProps) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')

  const categories = useMemo(() => [...createSet(articles.map((article) => article.category).filter(Boolean))].sort(), [articles])
  const tags = useMemo(() => [...createSet(articles.flatMap((article) => article.tags))].sort(), [articles])

  const visible = articles.filter(
    (article) =>
      (categoryFilter === 'all' || article.category === categoryFilter) && (tagFilter === 'all' || article.tags.includes(tagFilter))
  )

  // why: With a single article, filters are noise; they appear once the corpus can actually be narrowed
  const showFilters = articles.length > 1 && (categories.length > 1 || tags.length > 1)

  return (
    <div>
      {showFilters ? (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {categories.length > 1 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter articles by category">
              <FilterChip label="All" active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
              {categories.map((category) => (
                <FilterChip
                  key={category}
                  label={category}
                  active={categoryFilter === category}
                  onClick={() => setCategoryFilter(category)}
                />
              ))}
            </div>
          ) : null}
          {tags.length > 1 ? (
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              Tag
              <select
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">All tags</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-12 text-slate-600 dark:text-slate-400">No articles match this filter.</p>
      ) : (
        <div className="mt-12 grid gap-8">
          {visible.map((article) => (
            <Link
              key={article.slug}
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
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="mt-3 font-display text-2xl font-bold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
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
    </div>
  )
}

interface FilterChipProps {
  /** Chip label */
  label: string
  /** Whether this chip is the active filter */
  active: boolean
  /** Click handler */
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white dark:bg-primary-500'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}
