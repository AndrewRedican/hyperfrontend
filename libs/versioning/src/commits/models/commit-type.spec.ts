import { describe, expect, it } from '@hyperfrontend/testing'
import { COMMIT_TYPES, isStandardType, isReleaseType, getSemverBump, RELEASE_TYPES, MINOR_TYPES, PATCH_TYPES } from './commit-type'

describe('COMMIT_TYPES', () => {
  it('has all standard types', () => {
    expect(COMMIT_TYPES['feat'].description).toBe('A new feature')
    expect(COMMIT_TYPES['fix'].description).toBe('A bug fix')
    expect(COMMIT_TYPES['docs'].semverBump).toBe('none')
  })
})

describe('isStandardType', () => {
  it('returns true for standard types', () => {
    expect(isStandardType('feat')).toBe(true)
    expect(isStandardType('fix')).toBe(true)
  })

  it('returns false for non-standard types', () => {
    expect(isStandardType('custom')).toBe(false)
  })
})

describe('isReleaseType', () => {
  it('returns true for release types', () => {
    expect(isReleaseType('feat')).toBe(true)
    expect(isReleaseType('fix')).toBe(true)
  })

  it('returns false for non-release types', () => {
    expect(isReleaseType('docs')).toBe(false)
    expect(isReleaseType('chore')).toBe(false)
  })
})

describe('getSemverBump', () => {
  it('returns major for breaking changes', () => {
    expect(getSemverBump('feat', true)).toBe('major')
    expect(getSemverBump('fix', true)).toBe('major')
  })

  it('returns minor for features', () => {
    expect(getSemverBump('feat', false)).toBe('minor')
  })

  it('returns patch for fixes', () => {
    expect(getSemverBump('fix', false)).toBe('patch')
  })

  it('returns none for non-release types', () => {
    expect(getSemverBump('docs', false)).toBe('none')
    expect(getSemverBump('chore', false)).toBe('none')
  })

  it('returns none for unknown custom types', () => {
    expect(getSemverBump('custom-type', false)).toBe('none')
    expect(getSemverBump('unknown', false)).toBe('none')
  })
})

describe('type arrays', () => {
  it('RELEASE_TYPES includes feat and fix', () => {
    expect(RELEASE_TYPES).toContain('feat')
    expect(RELEASE_TYPES).toContain('fix')
  })

  it('MINOR_TYPES includes feat', () => {
    expect(MINOR_TYPES).toContain('feat')
  })

  it('PATCH_TYPES includes fix', () => {
    expect(PATCH_TYPES).toContain('fix')
  })
})
