import type { GuideIndexEntry } from './guides'
import { describe, expect, it } from 'vitest'
import { selectFeaturedGuides } from './landing-highlights'

/**
 * Build a guide index entry with only the fields the landing selection reads.
 *
 * @param slug - Guide slug, also its title so ordering is readable in a failure
 * @param packageName - The package the guide is primarily about
 * @param priority - Editorial priority
 * @returns A guide entry carrying just enough shape for the selection
 */
function guide(slug: string, packageName: string, priority: GuideIndexEntry['priority'] = 'P0'): GuideIndexEntry {
  return {
    slug,
    route: `/docs/guides/${slug}`,
    type: 'how-to',
    title: slug,
    problem: `${slug} problem`,
    outcome: `${slug} outcome`,
    priority,
    packages: [packageName],
    verification: { kind: 'demo', source: 'apps/demos/clock/src/main.ts' },
    keywords: [],
    headings: [],
  }
}

describe('selectFeaturedGuides', () => {
  it('opens on the flagship whatever the corpus order', () => {
    const guides = [guide('list-a', '@hyperfrontend/list-utils'), guide('features-a', '@hyperfrontend/features')]

    expect(selectFeaturedGuides(guides, 2)[0]).toEqual(expect.objectContaining({ slug: 'features-a' }))
  })

  it('descends the hierarchy after the flagship', () => {
    const guides = [
      guide('utils-a', '@hyperfrontend/string-utils'),
      guide('nexus-a', '@hyperfrontend/nexus'),
      guide('features-a', '@hyperfrontend/features'),
      guide('builder-a', '@hyperfrontend/builder'),
    ]

    expect(selectFeaturedGuides(guides, 4).map((entry) => entry.slug)).toEqual(['features-a', 'nexus-a', 'builder-a', 'utils-a'])
  })

  it('lets no package fill the band on its own', () => {
    const guides = [
      guide('features-a', '@hyperfrontend/features'),
      guide('features-b', '@hyperfrontend/features'),
      guide('features-c', '@hyperfrontend/features'),
      guide('nexus-a', '@hyperfrontend/nexus'),
    ]

    expect(selectFeaturedGuides(guides, 4).map((entry) => entry.slug)).toEqual(['features-a', 'features-b', 'nexus-a'])
  })

  it('prefers the higher editorial priority within a package', () => {
    const guides = [guide('features-late', '@hyperfrontend/features', 'P2'), guide('features-lead', '@hyperfrontend/features', 'P0')]

    expect(selectFeaturedGuides(guides, 1)).toEqual([expect.objectContaining({ slug: 'features-lead' })])
  })

  it('stops at the limit', () => {
    const guides = [guide('features-a', '@hyperfrontend/features'), guide('nexus-a', '@hyperfrontend/nexus')]

    expect(selectFeaturedGuides(guides, 1)).toHaveLength(1)
  })

  it('sinks a guide about a package no level names', () => {
    const guides = [guide('unplaced-a', '@hyperfrontend/not-a-package'), guide('utils-a', '@hyperfrontend/function-utils')]

    expect(selectFeaturedGuides(guides, 2).map((entry) => entry.slug)).toEqual(['utils-a', 'unplaced-a'])
  })

  it('returns nothing for an uncompiled corpus', () => {
    expect(selectFeaturedGuides([], 4)).toEqual([])
  })
})
