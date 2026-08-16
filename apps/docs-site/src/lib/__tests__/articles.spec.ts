import { describe, expect, it } from 'vitest'
import { formatArticleDate, getAllArticles, getArticle, splitList } from '../articles'

describe('splitList', () => {
  it('splits a comma-separated scalar into trimmed entries', () => {
    expect(splitList(' iframes,  security ,contracts ')).toEqual(['iframes', 'security', 'contracts'])
  })

  it('drops empty entries from stray commas', () => {
    expect(splitList(',a,,b,')).toEqual(['a', 'b'])
  })

  it('returns an empty list for undefined or blank input', () => {
    expect([splitList(undefined), splitList('')]).toEqual([[], []])
  })
})

describe('formatArticleDate', () => {
  it('renders an ISO date as prose', () => {
    expect(formatArticleDate('2026-07-22')).toBe('July 22, 2026')
  })

  it('returns unrecognized input unchanged', () => {
    expect(formatArticleDate('soon')).toBe('soon')
  })
})

describe('the real corpus', () => {
  it('parses taxonomy fields from flat comma-separated frontmatter', () => {
    expect(getArticle('microfrontends-from-first-principles')).toEqual(
      expect.objectContaining({
        category: 'first-principles',
        tags: ['microfrontends', 'iframes', 'security', 'contracts', 'architecture'],
        packages: ['@hyperfrontend/features', '@hyperfrontend/nexus'],
      })
    )
  })

  it('returns null for a slug that does not exist', () => {
    expect(getArticle('not-a-real-article')).toBeNull()
  })

  it('orders articles newest first by publication date', () => {
    const dates = getAllArticles().map((article) => article.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })
})
