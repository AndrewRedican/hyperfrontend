import type { FilterableArticle } from './article-filters'
import { describe, expect, it } from 'vitest'
import { articleYear, collectFilterTerms, filterArticles, groupArticlesByYear, searchFilterTerms, yearAnchor } from './article-filters'

const COMPARISON: FilterableArticle = { date: '2026-08-24', category: 'comparison', tags: ['module federation', 'iframes', 'architecture'] }
const PRINCIPLES: FilterableArticle = { date: '2026-07-22', category: 'first-principles', tags: ['iframes', 'security', 'architecture'] }
const EARLIER: FilterableArticle = { date: '2025-11-02', category: '', tags: ['security'] }
const ARTICLES = [COMPARISON, PRINCIPLES, EARLIER]
const TERMS = collectFilterTerms(ARTICLES)

describe('collectFilterTerms', () => {
  it('lists categories before tags, each sorted by name', () => {
    expect(TERMS.map((term) => term.id)).toEqual([
      'category:comparison',
      'category:first-principles',
      'tag:architecture',
      'tag:iframes',
      'tag:module federation',
      'tag:security',
    ])
  })

  it('counts how many articles carry each term', () => {
    expect(TERMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tag:security', count: 2 }),
        expect.objectContaining({ id: 'category:comparison', count: 1 }),
      ])
    )
  })

  it('skips an empty category', () => {
    expect(TERMS.some((term) => term.kind === 'category' && term.value === '')).toBe(false)
  })
})

describe('searchFilterTerms', () => {
  it('matches the typed text anywhere in a term, ignoring case', () => {
    expect(searchFilterTerms(TERMS, 'FRAME', []).map((term) => term.id)).toEqual(['tag:iframes'])
  })

  it('offers every term for an empty query', () => {
    expect(searchFilterTerms(TERMS, '  ', [])).toEqual(TERMS)
  })

  it('leaves out terms already chosen', () => {
    expect(searchFilterTerms(TERMS, '', ['tag:iframes', 'category:comparison']).map((term) => term.id)).not.toEqual(
      expect.arrayContaining(['tag:iframes', 'category:comparison'])
    )
  })
})

describe('filterArticles', () => {
  it('keeps every article when nothing is selected', () => {
    expect(filterArticles(ARTICLES, TERMS, [])).toEqual(ARTICLES)
  })

  it('narrows to the articles carrying a tag', () => {
    expect(filterArticles(ARTICLES, TERMS, ['tag:security'])).toEqual([PRINCIPLES, EARLIER])
  })

  it('requires every selected term', () => {
    expect(filterArticles(ARTICLES, TERMS, ['tag:security', 'tag:iframes'])).toEqual([PRINCIPLES])
  })

  it('narrows by a category and a tag together', () => {
    expect(filterArticles(ARTICLES, TERMS, ['category:comparison', 'tag:architecture'])).toEqual([COMPARISON])
  })

  it('returns nothing when the selected terms never meet', () => {
    expect(filterArticles(ARTICLES, TERMS, ['category:comparison', 'tag:security'])).toEqual([])
  })
})

describe('articleYear', () => {
  it('reads the year off the date', () => {
    expect(articleYear(EARLIER)).toBe('2025')
  })
})

describe('yearAnchor', () => {
  it('builds the id the year section carries', () => {
    expect(yearAnchor('2026')).toBe('year-2026')
  })
})

describe('groupArticlesByYear', () => {
  it('groups newest year first, keeping article order inside a year', () => {
    expect(groupArticlesByYear(ARTICLES)).toEqual([
      { year: '2026', articles: [COMPARISON, PRINCIPLES] },
      { year: '2025', articles: [EARLIER] },
    ])
  })

  it('yields one group for a corpus that spans one year', () => {
    expect(groupArticlesByYear([COMPARISON, PRINCIPLES]).map((group) => group.year)).toEqual(['2026'])
  })

  it('yields nothing for no articles', () => {
    expect(groupArticlesByYear([])).toEqual([])
  })
})
