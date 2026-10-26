import type { TypesExtractConfig } from './config'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseLock, serializeLock, staleSources } from './lock'

const CONFIG = {
  sources: {
    nx: { repo: 'nrwl/nx', ref: '23.3.0', include: ['packages/nx/src/'] },
    other: { repo: 'o/r', ref: 'main', include: ['src/'] },
  },
} as unknown as TypesExtractConfig

describe('parseLock', () => {
  it('reads the locked sources', () => {
    expect(parseLock('{"sources":{"nx":{"repo":"nrwl/nx","ref":"23.3.0","sha":"abc"}}}')).toEqual({
      sources: { nx: { repo: 'nrwl/nx', ref: '23.3.0', sha: 'abc' } },
    })
  })

  it('rejects text that is not JSON', () => {
    expect(() => parseLock('nope')).toThrow('the lock file is not JSON')
  })

  it('rejects a JSON value that is not an object', () => {
    expect(() => parseLock('[]')).toThrow('must hold an object')
  })

  it('rejects an object without sources', () => {
    expect(() => parseLock('{}')).toThrow('must hold a "sources" object')
  })

  it('rejects a source missing a field', () => {
    expect(() => parseLock('{"sources":{"nx":{"repo":"nrwl/nx","ref":"23.3.0"}}}')).toThrow('source nx must carry repo, ref and sha')
  })

  it('rejects a source that is not an object', () => {
    expect(() => parseLock('{"sources":{"nx":1}}')).toThrow('source nx must carry repo, ref and sha')
  })
})

describe('serializeLock', () => {
  it('writes the sources in name order with two-space indentation and a final newline', () => {
    const text = serializeLock({ sources: { zeta: { repo: 'z/z', ref: 'v1', sha: 'z' }, alpha: { repo: 'a/a', ref: 'v2', sha: 'a' } } })
    expect(text).toBe(
      '{\n  "sources": {\n    "alpha": {\n      "repo": "a/a",\n      "ref": "v2",\n      "sha": "a"\n    },\n    "zeta": {\n      "repo": "z/z",\n      "ref": "v1",\n      "sha": "z"\n    }\n  }\n}\n'
    )
  })

  it('round-trips through parseLock', () => {
    const lock = { sources: { nx: { repo: 'nrwl/nx', ref: '23.3.0', sha: 'abc' } } }
    expect(parseLock(serializeLock(lock))).toEqual(lock)
  })
})

describe('staleSources', () => {
  it('names every source when there is no lock', () => {
    expect(staleSources(null, CONFIG)).toEqual(['nx', 'other'])
  })

  it('names a source the lock pins at another ref', () => {
    const lock = { sources: { nx: { repo: 'nrwl/nx', ref: '23.2.0', sha: 'a' }, other: { repo: 'o/r', ref: 'main', sha: 'b' } } }
    expect(staleSources(lock, CONFIG)).toEqual(['nx'])
  })

  it('names a source the lock pins at another repository', () => {
    const lock = { sources: { nx: { repo: 'nrwl/nx', ref: '23.3.0', sha: 'a' }, other: { repo: 'o/fork', ref: 'main', sha: 'b' } } }
    expect(staleSources(lock, CONFIG)).toEqual(['other'])
  })

  it('names nothing when every source is pinned as configured', () => {
    const lock = { sources: { nx: { repo: 'nrwl/nx', ref: '23.3.0', sha: 'a' }, other: { repo: 'o/r', ref: 'main', sha: 'b' } } }
    expect(staleSources(lock, CONFIG)).toEqual([])
  })
})
