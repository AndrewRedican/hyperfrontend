import type { SearchDocument } from '../search/search-contract'
import { describe, expect, it } from 'vitest'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { normalize, search, tokenize } from '../search/search-engine'

const DOCUMENTS: SearchDocument[] = [
  {
    url: '/docs/libraries/nexus',
    title: 'Nexus',
    kind: 'library',
    description: 'Cross-window session protocol over postMessage',
    package: '@hyperfrontend/nexus',
    terms: ['postmessage', 'broker'],
    sections: [
      { title: 'Quick Start', anchor: 'quick-start' },
      { title: 'Security', anchor: 'security' },
    ],
  },
  {
    url: '/docs/guides/first-cross-window-connection',
    title: 'Your first cross-window connection',
    kind: 'guide',
    description: 'A page and an iframe that need to talk',
    package: '@hyperfrontend/nexus',
    terms: ['iframe', 'handshake'],
  },
  { url: '/docs/libraries/nexus', anchor: 'api-createBroker', title: 'createBroker', kind: 'api', package: '@hyperfrontend/nexus' },
  { url: '/articles/microfrontends-from-first-principles', title: 'Microfrontends from First Principles', kind: 'article' },
]

describe('normalize and tokenize', () => {
  it('collapses non-alphanumeric runs to single spaces', () => {
    expect(normalize('@hyperfrontend/nexus!!')).toBe('hyperfrontend nexus')
  })

  it('returns no tokens for a blank or symbol-only query', () => {
    expect([tokenize('   '), tokenize('@/#!')]).toEqual([[], []])
  })
})

describe('search', () => {
  it('returns nothing for an empty query', () => {
    expect(search(DOCUMENTS, '')).toEqual([])
  })

  it('ranks an exact title match above prefix and contains matches', () => {
    const results = search(DOCUMENTS, 'nexus')
    expect(results[0]).toEqual(expect.objectContaining({ href: '/docs/libraries/nexus/', kind: 'library' }))
  })

  it('finds an API symbol and deep-links its anchor', () => {
    const results = search(DOCUMENTS, 'createbroker')
    expect(results[0]).toEqual(expect.objectContaining({ href: '/docs/libraries/nexus/#api-createBroker', kind: 'api' }))
  })

  it('surfaces section matches with the parent document as context', () => {
    const results = search(DOCUMENTS, 'quick start')
    expect(results).toEqual([expect.objectContaining({ href: '/docs/libraries/nexus/#quick-start', context: 'Nexus' })])
  })

  it('applies AND semantics across every query token', () => {
    expect(search(DOCUMENTS, 'cross window zebra')).toEqual([])
  })

  it('matches package names typed with their npm punctuation', () => {
    const results = search(DOCUMENTS, '@hyperfrontend/nexus')
    expect(results.map((result) => result.href)).toContain('/docs/libraries/nexus/')
  })

  it('matches guide keywords when the title does not contain the query', () => {
    const results = search(DOCUMENTS, 'handshake')
    expect(results).toEqual([expect.objectContaining({ href: '/docs/guides/first-cross-window-connection/' })])
  })

  it('deduplicates results pointing at the same destination', () => {
    const hrefs = search(DOCUMENTS, 'nexus').map((result) => result.href)
    expect(hrefs).toEqual([...createSet(hrefs)])
  })

  it('is deterministic across repeated runs', () => {
    expect(search(DOCUMENTS, 'cross window')).toEqual(search(DOCUMENTS, 'cross window'))
  })

  it('honors the result limit', () => {
    expect(search(DOCUMENTS, 'nexus', 1)).toHaveLength(1)
  })
})
