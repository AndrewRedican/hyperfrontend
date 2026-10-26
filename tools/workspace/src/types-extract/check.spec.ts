import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { compareGenerated } from './check'

describe('compareGenerated', () => {
  it('reports nothing when every file matches', () => {
    const generated = createMap([
      ['a.ts', 'A'],
      ['b.ts', 'B'],
    ])
    expect(compareGenerated(generated, (path) => (path === 'a.ts' ? 'A' : 'B'))).toEqual({ missing: [], stale: [] })
  })

  it('tells missing files from stale ones', () => {
    const generated = createMap([
      ['a.ts', 'A'],
      ['b.ts', 'B'],
      ['c.ts', 'C'],
    ])
    expect(compareGenerated(generated, (path) => (path === 'a.ts' ? 'A' : path === 'b.ts' ? 'old' : null))).toEqual({
      missing: ['c.ts'],
      stale: ['b.ts'],
    })
  })
})
