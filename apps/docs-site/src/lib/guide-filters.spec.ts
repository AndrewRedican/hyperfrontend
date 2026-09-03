import type { GuideIndexEntry } from '../../scripts/generate-guides.types'
import { describe, expect, it } from 'vitest'
import { createURLSearchParams } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { buildGuidesHref, filterGuides, GUIDE_FILTER_ALL, GUIDES_ROUTE, readGuideFilter } from './guide-filters'

/**
 * Build a guide index entry with only the fields the filters read. The title
 * is the slug in words, so a search facet has something to match on.
 *
 * @param slug - Global identifier, also the route segment and the sort key
 * @param type - Which Diátaxis quadrant the guide sits in
 * @param packages - Every npm package the guide involves, the one it is primarily about first
 * @returns An index entry carrying just enough shape for the filters
 */
function guide(slug: string, type: GuideIndexEntry['type'], packages: string[]): GuideIndexEntry {
  return {
    slug,
    type,
    packages,
    route: `/docs/guides/${slug}`,
    title: slug.split('-').join(' '),
    problem: '',
    outcome: '',
    keywords: [] as string[],
    headings: [] as string[],
  } as GuideIndexEntry
}

const CORPUS = [
  guide('a-nexus-tutorial', 'tutorial', ['@hyperfrontend/nexus']),
  guide('b-crosses-into-nexus', 'how-to', ['@hyperfrontend/features', '@hyperfrontend/nexus']),
  guide('c-nexus-how-to', 'how-to', ['@hyperfrontend/nexus']),
]

describe('buildGuidesHref', () => {
  it('addresses the unfiltered index with no query string', () => {
    expect(buildGuidesHref()).toBe(GUIDES_ROUTE)
  })

  it('drops facets left at the all-value rather than serializing them', () => {
    expect(buildGuidesHref({ package: GUIDE_FILTER_ALL, type: GUIDE_FILTER_ALL })).toBe(GUIDES_ROUTE)
  })

  it('encodes the package name the way the README links spell it', () => {
    expect(buildGuidesHref({ package: '@hyperfrontend/nexus' })).toBe('/docs/guides/?package=%40hyperfrontend%2Fnexus')
  })

  it('carries the type facet alone', () => {
    expect(buildGuidesHref({ type: 'tutorial' })).toBe('/docs/guides/?type=tutorial')
  })

  it('carries both facets in a stable order', () => {
    expect(buildGuidesHref({ package: '@hyperfrontend/nexus', type: 'how-to' })).toBe(
      '/docs/guides/?package=%40hyperfrontend%2Fnexus&type=how-to'
    )
  })

  it('carries the search after the facets that narrow', () => {
    expect(buildGuidesHref({ type: 'tutorial', query: 'cross window' })).toBe('/docs/guides/?type=tutorial&q=cross+window')
  })

  it('drops a search that is only whitespace rather than serializing it', () => {
    expect(buildGuidesHref({ query: '   ' })).toBe(GUIDES_ROUTE)
  })
})

describe('readGuideFilter', () => {
  it('falls back to the all-value for both facets and an empty search on a bare URL', () => {
    expect(readGuideFilter(createURLSearchParams())).toEqual({ package: GUIDE_FILTER_ALL, type: GUIDE_FILTER_ALL, query: '' })
  })

  it('round-trips a href built for a package and type', () => {
    const query = buildGuidesHref({ package: '@hyperfrontend/nexus', type: 'tutorial' }).split('?')[1] ?? ''
    expect(readGuideFilter(createURLSearchParams(query))).toEqual({
      package: '@hyperfrontend/nexus',
      type: 'tutorial',
      query: '',
    })
  })

  it('round-trips a href built for a search', () => {
    const query = buildGuidesHref({ query: 'cross window' }).split('?')[1] ?? ''
    expect(readGuideFilter(createURLSearchParams(query))).toEqual({
      package: GUIDE_FILTER_ALL,
      type: GUIDE_FILTER_ALL,
      query: 'cross window',
    })
  })
})

describe('filterGuides', () => {
  it('returns the corpus untouched when neither facet narrows', () => {
    expect(filterGuides(CORPUS)).toEqual(CORPUS)
  })

  it('includes a cross-cutting guide under every package it involves', () => {
    expect(filterGuides(CORPUS, { package: '@hyperfrontend/nexus' }).map((entry) => entry.slug)).toEqual([
      'a-nexus-tutorial',
      'c-nexus-how-to',
      'b-crosses-into-nexus',
    ])
  })

  it('narrows to one document type', () => {
    expect(filterGuides(CORPUS, { type: 'tutorial' })).toEqual([CORPUS[0]])
  })

  it('applies both facets together', () => {
    expect(filterGuides(CORPUS, { package: '@hyperfrontend/nexus', type: 'how-to' }).map((entry) => entry.slug)).toEqual([
      'c-nexus-how-to',
      'b-crosses-into-nexus',
    ])
  })

  it('returns nothing for a package no guide involves', () => {
    expect(filterGuides(CORPUS, { package: '@hyperfrontend/questions' })).toEqual([])
  })

  it('leaves the source array unsorted when narrowing by package', () => {
    const source = [...CORPUS]
    filterGuides(source, { package: '@hyperfrontend/nexus' })
    expect(source).toEqual(CORPUS)
  })

  it('narrows to the guides a reader searched for', () => {
    expect(filterGuides(CORPUS, { query: 'crosses' }).map((entry) => entry.slug)).toEqual(['b-crosses-into-nexus'])
  })

  it('applies the search after the facets that narrow', () => {
    expect(filterGuides(CORPUS, { type: 'tutorial', query: 'crosses' })).toEqual([])
  })

  it('keeps ownership order as the tiebreak between equally relevant guides', () => {
    expect(filterGuides(CORPUS, { package: '@hyperfrontend/nexus', query: 'nexus' }).map((entry) => entry.slug)).toEqual([
      'a-nexus-tutorial',
      'c-nexus-how-to',
      'b-crosses-into-nexus',
    ])
  })
})
