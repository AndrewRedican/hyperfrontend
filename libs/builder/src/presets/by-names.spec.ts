import { describe, expect, it } from '@hyperfrontend/testing'
import { byNames } from './by-names'

describe('byNames', () => {
  it('returns true for every name in the configured list', () => {
    const predicate = byNames(['@scope/a', 'internal-utils'])
    expect(predicate('@scope/a')).toBe(true)
    expect(predicate('internal-utils')).toBe(true)
  })

  it('returns false for names not in the list', () => {
    const predicate = byNames(['@scope/a'])
    expect(predicate('@scope/b')).toBe(false)
    expect(predicate('rollup')).toBe(false)
  })

  it('returns false for every name when the list is empty', () => {
    const predicate = byNames([])
    expect(predicate('@scope/a')).toBe(false)
    expect(predicate('')).toBe(false)
  })

  it('does not treat substring matches as a hit (exact match only)', () => {
    const predicate = byNames(['@scope/a'])
    expect(predicate('@scope/aa')).toBe(false)
    expect(predicate('@scope')).toBe(false)
  })

  it('snapshots the supplied list — later mutations to the original array are not observed', () => {
    const names = ['@scope/a']
    const predicate = byNames(names)
    names.push('@scope/b')
    expect(predicate('@scope/b')).toBe(false)
  })
})
