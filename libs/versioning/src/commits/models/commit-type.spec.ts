import { describe, expect, it } from '@hyperfrontend/testing'
import { COMMIT_TYPES, isStandardType, isReleaseType, getSemverBump, RELEASE_TYPES, MINOR_TYPES, PATCH_TYPES } from './commit-type'

describe('COMMIT_TYPES', () => {
  it('has all standard types', () => {
    expect(COMMIT_TYPES).toMatchObject({
      feat: { description: 'A new feature' },
      fix: { description: 'A bug fix' },
      docs: { semverBump: 'none' },
    })
  })
})

describe('isStandardType', () => {
  it('returns true for standard types', () => {
    expect(['feat', 'fix'].map((type) => isStandardType(type))).toEqual([true, true])
  })

  it('returns false for non-standard types', () => {
    expect(isStandardType('custom')).toBe(false)
  })
})

describe('isReleaseType', () => {
  it('returns true for release types', () => {
    expect(['feat', 'fix'].map((type) => isReleaseType(type))).toEqual([true, true])
  })

  it('returns false for non-release types', () => {
    expect(['docs', 'chore'].map((type) => isReleaseType(type))).toEqual([false, false])
  })
})

describe('getSemverBump', () => {
  it('returns major for breaking changes', () => {
    expect(['feat', 'fix'].map((type) => getSemverBump(type, true))).toEqual(['major', 'major'])
  })

  it('returns minor for features', () => {
    expect(getSemverBump('feat', false)).toBe('minor')
  })

  it('returns patch for fixes', () => {
    expect(getSemverBump('fix', false)).toBe('patch')
  })

  it('returns none for non-release types', () => {
    expect(['docs', 'chore'].map((type) => getSemverBump(type, false))).toEqual(['none', 'none'])
  })

  it('returns none for unknown custom types', () => {
    expect(['custom-type', 'unknown'].map((type) => getSemverBump(type, false))).toEqual(['none', 'none'])
  })
})

describe('type arrays', () => {
  it('RELEASE_TYPES includes feat and fix', () => {
    expect(RELEASE_TYPES).toEqual(expect.arrayContaining(['feat', 'fix']))
  })

  it('MINOR_TYPES includes feat', () => {
    expect(MINOR_TYPES).toContain('feat')
  })

  it('PATCH_TYPES includes fix', () => {
    expect(PATCH_TYPES).toContain('fix')
  })
})
