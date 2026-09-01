import { describe, expect, it } from '@hyperfrontend/testing'
import { canonicalVersion } from './canonical-version'

describe('canonicalVersion', () => {
  it('returns a canonical version unchanged', () => {
    expect(canonicalVersion('1.2.0')).toBe('1.2.0')
  })

  it('canonicalizes a v-prefixed spelling', () => {
    expect(canonicalVersion('v1.2.0')).toBe('1.2.0')
  })

  it('throws on a version that is not valid semver', () => {
    expect(() => canonicalVersion('latest')).toThrow()
  })
})
