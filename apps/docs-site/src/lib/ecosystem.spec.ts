import type { EcosystemLibrary } from './ecosystem'
import { describe, expect, it } from 'vitest'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { LIBRARIES } from './content'
import { buildEcosystem, ECOSYSTEM_TIERS, selectTopics } from './ecosystem'

/**
 * Build a library with only the fields the ecosystem model reads.
 *
 * @param packageName - npm package name, the key the hierarchy is joined on
 * @param keywords - Keywords the card would draw its topics from
 * @returns A library carrying just enough shape for the model
 */
function library(packageName: string, keywords: string[] = []): EcosystemLibrary {
  return {
    packageName,
    keywords,
    name: packageName.replace('@hyperfrontend/', ''),
    description: `${packageName} description`,
    version: '1.0.0',
    isPrivate: false,
    href: `/docs/libraries/${packageName.replace('@hyperfrontend/', '')}`,
  }
}

const PLACED_PACKAGES = ECOSYSTEM_TIERS.flatMap((tier) => tier.packages)

describe('ECOSYSTEM_TIERS', () => {
  it('places every documented library exactly once', () => {
    const placed = createSet(PLACED_PACKAGES)

    expect(PLACED_PACKAGES.length).toBe(placed.size)
    for (const lib of LIBRARIES) {
      expect(PLACED_PACKAGES).toContain(lib.packageName)
    }
  })

  it('names no package the docs site does not document', () => {
    const documented = createSet(LIBRARIES.map((lib) => lib.packageName))

    for (const packageName of PLACED_PACKAGES) {
      expect(documented.has(packageName)).toBe(true)
    }
  })

  it('opens on the flagship SDK alone', () => {
    expect(ECOSYSTEM_TIERS[0].packages).toEqual(['@hyperfrontend/features'])
    expect(ECOSYSTEM_TIERS[0].emphasis).toBe('apex')
  })

  it('never regains emphasis on the way down', () => {
    const weight = { apex: 3, strong: 2, medium: 1, soft: 0 }

    for (let index = 1; index < ECOSYSTEM_TIERS.length; index++) {
      expect(weight[ECOSYSTEM_TIERS[index].emphasis]).toBeLessThanOrEqual(weight[ECOSYSTEM_TIERS[index - 1].emphasis])
    }
  })

  it('labels every level below the apex', () => {
    for (const tier of ECOSYSTEM_TIERS.slice(1)) {
      expect(tier.label).not.toBe('')
    }
  })

  it('carries a distinct identifier per level', () => {
    expect(createSet(ECOSYSTEM_TIERS.map((tier) => tier.id)).size).toBe(ECOSYSTEM_TIERS.length)
  })
})

describe('selectTopics', () => {
  it('keeps the package author ordering', () => {
    expect(selectTopics(['postmessage', 'cross-window', 'iframe'], '@hyperfrontend/nexus', 3)).toEqual([
      'postmessage',
      'cross-window',
      'iframe',
    ])
  })

  it('stops at the limit', () => {
    expect(selectTopics(['a-one', 'b-two', 'c-three'], '@hyperfrontend/nexus', 2)).toEqual(['a-one', 'b-two'])
  })

  it('drops the keyword that only repeats the package name', () => {
    expect(selectTopics(['logging', 'logger'], '@hyperfrontend/logging', 2)).toEqual(['logger'])
  })

  it('drops keywords that exist to be searched for rather than read', () => {
    expect(selectTopics(['typescript', 'zero-dependencies', 'ajv', 'schema-validator'], '@hyperfrontend/json-utils', 3)).toEqual([
      'schema-validator',
    ])
  })

  it('collapses spellings of one idea onto the first of them', () => {
    expect(selectTopics(['micro-frontend', 'microfrontend', 'micro-frontends', 'mfe'], '@hyperfrontend/features', 4)).toEqual([
      'micro-frontend',
      'mfe',
    ])
  })

  it('collapses a keyword that only extends one already kept', () => {
    expect(selectTopics(['build', 'build-tool', 'build-toolkit', 'bundler'], '@hyperfrontend/builder', 3)).toEqual(['build', 'bundler'])
  })

  it('returns nothing for a package that lists no keywords', () => {
    expect(selectTopics([], '@hyperfrontend/web-worker', 3)).toEqual([])
  })
})

describe('buildEcosystem', () => {
  it('orders the levels as the model declares them', () => {
    const levels = buildEcosystem([
      library('@hyperfrontend/data-utils'),
      library('@hyperfrontend/features'),
      library('@hyperfrontend/nexus'),
    ])

    expect(levels.map((level) => level.tier.id)).toEqual(['sdk', 'messaging', 'utilities'])
  })

  it('orders the packages within a level as the model declares them', () => {
    const levels = buildEcosystem([library('@hyperfrontend/network-protocol'), library('@hyperfrontend/nexus')])

    expect(levels[0].cards.map((card) => card.packageName)).toEqual(['@hyperfrontend/nexus', '@hyperfrontend/network-protocol'])
  })

  it('drops a level nothing lands on, so a filtered view collapses cleanly', () => {
    expect(buildEcosystem([library('@hyperfrontend/features')]).map((level) => level.tier.id)).toEqual(['sdk'])
  })

  it('shows a package no level claims rather than losing it', () => {
    const levels = buildEcosystem([library('@hyperfrontend/features'), library('@hyperfrontend/newcomer')])

    expect(levels[levels.length - 1].cards.map((card) => card.packageName)).toContain('@hyperfrontend/newcomer')
  })

  it('gives each card the topics its own level allows', () => {
    const keywords = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf']
    const levels = buildEcosystem([library('@hyperfrontend/features', keywords), library('@hyperfrontend/logging', keywords)])

    expect(levels[0].cards[0].topics).toHaveLength(ECOSYSTEM_TIERS[0].topicLimit)
    expect(levels[1].cards[0].topics).toHaveLength(ECOSYSTEM_TIERS[4].topicLimit)
  })

  it('carries the library fields the cards render', () => {
    const card = buildEcosystem([library('@hyperfrontend/features')])[0].cards[0]

    expect(card.description).toBe('@hyperfrontend/features description')
    expect(card.href).toBe('/docs/libraries/features')
    expect(card.version).toBe('1.0.0')
  })

  it('places nothing when there is nothing to place', () => {
    expect(buildEcosystem([])).toEqual([])
  })
})
