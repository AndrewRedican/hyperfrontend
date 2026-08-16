import type { Article } from '../articles'
import { describe, expect, it } from 'vitest'
import { buildArticlesFeed } from '../feed'

/**
 * Build a minimal article for feed serialization tests.
 *
 * @param overrides - Fields to override on the base article
 * @returns A complete article
 */
function article(overrides: Partial<Article>): Article {
  return {
    slug: 'example',
    title: 'Example',
    description: 'An example.',
    date: '2026-01-01',
    author: 'Author',
    readingTime: '5 min read',
    heroImage: '',
    category: '',
    tags: [],
    packages: [],
    related: [],
    updated: '',
    content: '',
    ...overrides,
  }
}

const ARTICLES = [
  article({ slug: 'older', title: 'Older & Wiser', date: '2026-01-01', tags: ['a<b'] }),
  article({ slug: 'newer', title: 'Newer', date: '2026-03-05', updated: '2026-04-01', category: 'first-principles' }),
]

describe('buildArticlesFeed', () => {
  const xml = buildArticlesFeed(ARTICLES, 'https://hyperfrontend.dev')

  it('serializes well-formed XML', () => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml')
    expect(parsed.querySelector('parsererror')).toBeNull()
  })

  it('orders entries newest first regardless of input order', () => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml')
    const ids = [...parsed.querySelectorAll('entry > id')].map((node) => node.textContent)
    expect(ids).toEqual(['https://hyperfrontend.dev/articles/newer/', 'https://hyperfrontend.dev/articles/older/'])
  })

  it('carries the required Atom fields on every entry', () => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml')
    const entries = [...parsed.querySelectorAll('entry')]
    expect(
      entries.map((entry) =>
        ['title', 'link', 'id', 'published', 'updated', 'author', 'summary'].every(
          (tag) => entry.querySelector(tag) ?? entry.querySelector(`[href]`)
        )
      )
    ).toEqual([true, true])
  })

  it('links canonical trailing-slash URLs', () => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml')
    const hrefs = [...parsed.querySelectorAll('entry > link')].map((node) => node.getAttribute('href'))
    expect(hrefs).toEqual(['https://hyperfrontend.dev/articles/newer/', 'https://hyperfrontend.dev/articles/older/'])
  })

  it('uses the revision date when an article has been updated', () => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml')
    const updated = parsed.querySelector('entry > updated')
    expect(updated?.textContent).toBe('2026-04-01T00:00:00.000Z')
  })

  it('stamps the feed with the newest revision across articles', () => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml')
    expect(parsed.querySelector('feed > updated')?.textContent).toBe('2026-04-01T00:00:00.000Z')
  })

  it('escapes markup-significant characters from article content', () => {
    expect(xml).toContain('Older &amp; Wiser')
  })

  it('emits categories from the article category and tags', () => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml')
    const terms = [...parsed.querySelectorAll('category')].map((node) => node.getAttribute('term'))
    expect(terms).toEqual(['first-principles', 'a<b'])
  })
})
