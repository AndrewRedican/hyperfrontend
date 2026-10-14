import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { defaultScope } from './default-scope'

// why: discovered scope paths are native joins, so the fixtures must carry the platform separator for the prefix test.
const native = (path: string): string => normalizeToNative(path)

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
        { name: 'root', path: native('/repo') },
        { name: 'alpha', path: native('/repo/libs/alpha') },
        { name: 'beta', path: native('/repo/libs/beta') },
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
        { name: 'root', path: native('/repo/') },
        { name: 'alpha', path: native('/repo/libs/alpha') },
      ])
    ).toBe('root')
  })
})
