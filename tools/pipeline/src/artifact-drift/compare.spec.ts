import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { compareArtifacts, isIdentical, renderDrift } from './compare'
import { contentHash } from './pack'

const local = createMap([
  ['index.js', 'same'],
  ['changed.js', 'new'],
  ['added.js', 'add'],
])
const published = createMap([
  ['index.js', 'same'],
  ['changed.js', 'old'],
  ['removed.js', 'gone'],
])

describe('compareArtifacts', () => {
  it('lists the added, removed and changed files with both content hashes', () => {
    expect(compareArtifacts('pkg', '1.0.0', local, published)).toEqual({
      name: 'pkg',
      version: '1.0.0',
      local: contentHash(local),
      published: contentHash(published),
      added: ['added.js'],
      removed: ['removed.js'],
      changed: ['changed.js'],
    })
  })
})

describe('isIdentical', () => {
  it('is true only without differences', () => {
    expect([
      isIdentical(compareArtifacts('pkg', '1.0.0', local, local)),
      isIdentical(compareArtifacts('pkg', '1.0.0', local, published)),
    ]).toEqual([true, false])
  })
})

describe('renderDrift', () => {
  it('prints a heading and one line per differing file', () => {
    const drift = compareArtifacts('pkg', '1.0.0', local, published)
    expect(renderDrift(drift)).toEqual([
      `pkg@1.0.0: differs from the registry (local ${drift.local.slice(0, 12)}, published ${drift.published.slice(0, 12)})`,
      '  + added.js',
      '  - removed.js',
      '  ~ changed.js',
    ])
  })

  it('prints the heading alone for identical packs', () => {
    expect(renderDrift(compareArtifacts('pkg', '1.0.0', local, local))).toEqual([expect.stringContaining('identical to the registry')])
  })
})
