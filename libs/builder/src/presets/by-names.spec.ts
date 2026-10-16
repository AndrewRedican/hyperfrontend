import { describe, expect, it } from '@hyperfrontend/testing'
import { byNames } from './by-names'

describe('byNames', () => {
  it('returns true for every name in the configured list', () => {
    const predicate = byNames(['@scope/a', 'internal-utils'])
    expect(['@scope/a', 'internal-utils'].filter((name) => !predicate(name))).toEqual([])
  })

  it('returns false for names not in the list', () => {
    const predicate = byNames(['@scope/a'])
    expect(['@scope/b', 'rollup'].filter((name) => predicate(name))).toEqual([])
  })

  it('returns false for every name when the list is empty', () => {
    const predicate = byNames([])
    expect(['@scope/a', ''].filter((name) => predicate(name))).toEqual([])
  })

  it('does not treat substring matches as a hit (exact match only)', () => {
    const predicate = byNames(['@scope/a'])
    expect(['@scope/aa', '@scope'].filter((name) => predicate(name))).toEqual([])
  })

  it('snapshots the supplied list — later mutations to the original array are not observed', () => {
    const names = ['@scope/a']
    const predicate = byNames(names)
    names.push('@scope/b')
    expect(predicate('@scope/b')).toBe(false)
  })
})
