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
    const types = ['feat', 'fix']
    expect(types.map((type) => [type, isStandardType(type)])).toEqual(types.map((type) => [type, true]))
  })

  it('returns false for non-standard types', () => {
    expect(isStandardType('custom')).toBe(false)
  })
})

describe('isReleaseType', () => {
  it('returns true for release types', () => {
    const types = ['feat', 'fix']
    expect(types.map((type) => [type, isReleaseType(type)])).toEqual(types.map((type) => [type, true]))
  })

  it('returns false for non-release types', () => {
    const types = ['docs', 'chore']
    expect(types.map((type) => [type, isReleaseType(type)])).toEqual(types.map((type) => [type, false]))
  })
})

describe('getSemverBump', () => {
  it('returns major for breaking changes', () => {
    const types = ['feat', 'fix']
    expect(types.map((type) => [type, getSemverBump(type, true)])).toEqual(types.map((type) => [type, 'major']))
  })

  it('returns minor for features', () => {
    expect(getSemverBump('feat', false)).toBe('minor')
  })

  it('returns patch for fixes', () => {
    expect(getSemverBump('fix', false)).toBe('patch')
  })

  it('returns none for non-release types', () => {
    const types = ['docs', 'chore']
    expect(types.map((type) => [type, getSemverBump(type, false)])).toEqual(types.map((type) => [type, 'none']))
  })

  it('returns none for unknown custom types', () => {
    const types = ['custom-type', 'unknown']
    expect(types.map((type) => [type, getSemverBump(type, false)])).toEqual(types.map((type) => [type, 'none']))
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
