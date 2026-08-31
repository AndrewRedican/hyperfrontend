import { describe, expect, it } from '@hyperfrontend/testing'
import { defaultScope } from './default-scope'

describe('defaultScope', () => {
  it('returns undefined for an empty candidate list', () => {
    expect(defaultScope([])).toBeUndefined()
  })

  it('returns the single candidate unconditionally', () => {
    expect(defaultScope([{ name: 'alpha', path: '/repo/libs/alpha' }])).toBe('alpha')
  })

  it('returns the common-ancestor scope when one owns all others', () => {
    expect(
      defaultScope([
        { name: 'root', path: '/repo' },
        { name: 'alpha', path: '/repo/libs/alpha' },
        { name: 'beta', path: '/repo/libs/beta' },
      ])
    ).toBe('root')
  })

  it('returns undefined when candidates are disjoint siblings', () => {
    expect(
      defaultScope([
        { name: 'alpha', path: '/repo/libs/alpha' },
        { name: 'beta', path: '/repo/libs/beta' },
      ])
    ).toBeUndefined()
  })

  it('treats a trailing-slash ancestor path identically', () => {
    expect(
      defaultScope([
        { name: 'root', path: '/repo/' },
        { name: 'alpha', path: '/repo/libs/alpha' },
      ])
    ).toBe('root')
  })
})
