import { describe, expect, it } from '@hyperfrontend/testing'
import { byPrefix } from './by-prefix'

describe('byPrefix', () => {
  it('returns true when the package name starts with the configured scope', () => {
    const predicate = byPrefix('@hyperfrontend/')
    expect(predicate('@hyperfrontend/logging')).toBe(true)
  })

  it('returns false when the package name does not start with the scope', () => {
    const predicate = byPrefix('@hyperfrontend/')
    expect(predicate('rollup')).toBe(false)
  })

  it('treats the scope as a literal prefix and rejects look-alike scopes', () => {
    const predicate = byPrefix('@hyperfrontend/')
    expect(predicate('@hyperfrontend-foo/bar')).toBe(false)
  })

  it('returns true for the bare prefix when supplied verbatim', () => {
    const predicate = byPrefix('@hyperfrontend/')
    expect(predicate('@hyperfrontend/')).toBe(true)
  })

  it('matches every name when supplied an empty scope', () => {
    const predicate = byPrefix('')
    expect(predicate('anything')).toBe(true)
    expect(predicate('')).toBe(true)
  })

  it('returns a stable closure that does not retain mutable state', () => {
    const predicate = byPrefix('@scope/')
    const first = predicate('@scope/a')
    const second = predicate('@scope/b')
    expect(first).toBe(true)
    expect(second).toBe(true)
  })
})
