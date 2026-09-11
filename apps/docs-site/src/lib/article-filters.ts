import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/**
 * The facts about an article that the index filters and groups on.
 */
export interface FilterableArticle {
  /** Publication date in YYYY-MM-DD format */
  date: string
  /** Content category, empty when uncategorized */
  category: string
  /** Discovery tags */
  tags: string[]
}

/**
 * Where a filter term comes from: an article's one editorial category, or one
 * of its discovery tags.
 *
 * They are one vocabulary on the index because a reader narrowing the list
 * does not care which frontmatter field a word lives in; the kind survives so
 * the control can say it, and so a category and a tag with the same spelling
 * stay two terms rather than one.
 */
export type FilterTermKind = 'category' | 'tag'

/**
 * One term a reader can narrow the index by.
 */
export interface FilterTerm {
  /** Stable identity, `${kind}:${value}` */
  id: string
  /** Which frontmatter field the term came from */
  kind: FilterTermKind
  /** The term as the frontmatter spells it */
  value: string
  /** How many articles carry it */
  count: number
}

/**
 * Whether a term appears on an article.
 *
 * @param article - The article being tested
 * @param term - The category or tag looked for
 * @returns True when the article carries the term
 */
function articleHasTerm(article: FilterableArticle, term: FilterTerm): boolean {
  return term.kind === 'category' ? article.category === term.value : article.tags.includes(term.value)
}

/**
 * Every term the corpus offers, categories first, each kind sorted by name.
 *
 * Built from the articles rather than declared, so a tag used by one new
 * article is filterable the day it is published and a tag no article carries
 * any more is gone with it.
 *
 * @param articles - The articles on the index
 * @returns The vocabulary, categories before tags
 *
 * @example Reading the vocabulary off two articles
 * ```typescript
 * collectFilterTerms([
 *   { date: '2026-08-24', category: 'comparison', tags: ['iframes'] },
 *   { date: '2026-07-22', category: 'first-principles', tags: ['iframes', 'security'] },
 * ]).map((term) => term.id)
 * // ['category:comparison', 'category:first-principles', 'tag:iframes', 'tag:security']
 * ```
 */
export function collectFilterTerms(articles: readonly FilterableArticle[]): FilterTerm[] {
  const terms = createMap<string, FilterTerm>()

  const record = (kind: FilterTermKind, value: string): void => {
    if (!value) return
    const id = `${kind}:${value}`
    const existing = terms.get(id)
    if (existing) {
      existing.count += 1
    } else {
      terms.set(id, { id, kind, value, count: 1 })
    }
  }

  for (const article of articles) {
    record('category', article.category)
    for (const tag of article.tags) record('tag', tag)
  }

  return [...terms.values()].sort((a, b) => (a.kind === b.kind ? a.value.localeCompare(b.value) : a.kind === 'category' ? -1 : 1))
}

/**
 * The terms whose spelling contains what a reader has typed, minus the ones
 * already chosen.
 *
 * @param terms - The vocabulary
 * @param query - What the reader typed, matched case-insensitively anywhere in the term
 * @param selected - Ids of the terms already chosen
 * @returns The candidates, in vocabulary order
 */
export function searchFilterTerms(terms: readonly FilterTerm[], query: string, selected: readonly string[]): FilterTerm[] {
  const needle = query.trim().toLowerCase()
  return terms.filter((term) => !selected.includes(term.id) && (needle === '' || term.value.toLowerCase().includes(needle)))
}

/**
 * The articles that carry every selected term.
 *
 * Selections narrow. Each term a reader adds is a further condition, so the
 * list only ever gets shorter as they go, and the way to see more is to take
 * a term off. With no terms selected nothing is excluded, which is what makes
 * "all" a state of the control rather than a term in it. The corpus's tags
 * overlap heavily, and a union would make a second selection widen a list the
 * reader had just narrowed, which is the one thing a filter must not do.
 *
 * @param articles - The articles on the index
 * @param terms - The vocabulary, so a selected id can be resolved
 * @param selected - Ids of the chosen terms
 * @returns The articles carrying all of them, in the order given
 *
 * @example Narrowing by a category and a tag together
 * ```typescript
 * filterArticles(articles, terms, ['category:comparison', 'tag:iframes'])
 * // only the comparison articles that are also tagged iframes
 * ```
 */
export function filterArticles<T extends FilterableArticle>(
  articles: readonly T[],
  terms: readonly FilterTerm[],
  selected: readonly string[]
): T[] {
  const chosen = terms.filter((term) => selected.includes(term.id))
  return articles.filter((article) => chosen.every((term) => articleHasTerm(article, term)))
}

/**
 * The publication year of an article.
 *
 * @param article - The article whose date is read
 * @returns The four-digit year, as the date states it
 */
export function articleYear(article: FilterableArticle): string {
  return article.date.slice(0, 4)
}

/**
 * The id the year's section on the index is addressed by.
 *
 * @param year - A four-digit year
 * @returns The anchor id, `year-2026` for 2026
 */
export function yearAnchor(year: string): string {
  return `year-${year}`
}

/**
 * One year of the index, with the articles published in it.
 */
export interface ArticleYearGroup<T> {
  /** The four-digit year */
  year: string
  /** The articles published in it, in the order given */
  articles: T[]
}

/**
 * Articles grouped by the year they were published, newest year first.
 *
 * The years are read off the articles, so the navigation built from these
 * groups names exactly the years the corpus spans and updates as it grows in
 * either direction. Within a year the articles keep the order they arrived
 * in, which the index supplies newest first.
 *
 * @param articles - The articles to group, newest first
 * @returns One group per year that has an article, newest year first
 *
 * @example A corpus that so far spans one year
 * ```typescript
 * groupArticlesByYear([{ date: '2026-08-24', ... }, { date: '2026-07-22', ... }]).map((group) => group.year)
 * // ['2026']
 * ```
 */
export function groupArticlesByYear<T extends FilterableArticle>(articles: readonly T[]): ArticleYearGroup<T>[] {
  const groups = createMap<string, ArticleYearGroup<T>>()

  for (const article of articles) {
    const year = articleYear(article)
    const group = groups.get(year)
    if (group) {
      group.articles.push(article)
    } else {
      groups.set(year, { year, articles: [article] })
    }
  }

  return [...groups.values()].sort((a, b) => b.year.localeCompare(a.year))
}
