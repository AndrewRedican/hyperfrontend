import { describe, expect, it } from '@hyperfrontend/testing'
import { createComparator, createComparatorSet, createRange } from '../models/range'
import { createSemVer } from '../models/version'
import { format, formatSimple, formatRange, formatComparator } from './to-string'

describe('format', () => {
  it('formats basic version', () => {
    const v = createSemVer({ major: 1, minor: 2, patch: 3 })
    expect(format(v)).toBe('1.2.3')
  })

  it('formats version with prerelease', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] })
    expect(format(v)).toBe('1.0.0-alpha.1')
  })

  it('formats version with build metadata', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, build: ['build', '123'] })
    expect(format(v)).toBe('1.0.0+build.123')
  })

  it('formats version with prerelease and build', () => {
    const v = createSemVer({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ['beta', '2'],
      build: ['sha', 'abc123'],
    })
    expect(format(v)).toBe('1.0.0-beta.2+sha.abc123')
  })

  it('formats 0.0.0', () => {
    const v = createSemVer({ major: 0, minor: 0, patch: 0 })
    expect(format(v)).toBe('0.0.0')
  })
})

describe('formatSimple', () => {
  it('formats without prerelease/build', () => {
    const v = createSemVer({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ['alpha'],
      build: ['build'],
    })
    expect(formatSimple(v)).toBe('1.2.3')
  })
})

describe('formatComparator', () => {
  it('formats >= comparator', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const c = createComparator('>=', v)
    expect(formatComparator(c)).toBe('>=1.0.0')
  })

  it('formats = comparator without operator', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const c = createComparator('=', v)
    expect(formatComparator(c)).toBe('1.0.0')
  })

  it('formats < comparator', () => {
    const v = createSemVer({ major: 2, minor: 0, patch: 0 })
    const c = createComparator('<', v)
    expect(formatComparator(c)).toBe('<2.0.0')
  })
})

describe('formatRange', () => {
  it('uses raw if available', () => {
    const range = createRange([], '^1.0.0')
    expect(formatRange(range)).toBe('^1.0.0')
  })

  it('formats empty range as wildcard', () => {
    const range = createRange([])
    expect(formatRange(range)).toBe('*')
  })

  it('formats single set', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const set = createComparatorSet([createComparator('>=', v)])
    const range = createRange([set])
    expect(formatRange(range)).toBe('>=1.0.0')
  })

  it('formats AND set', () => {
    const v1 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 2, minor: 0, patch: 0 })
    const set = createComparatorSet([createComparator('>=', v1), createComparator('<', v2)])
    const range = createRange([set])
    expect(formatRange(range)).toBe('>=1.0.0 <2.0.0')
  })

  it('formats OR ranges', () => {
    const v1 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 2, minor: 0, patch: 0 })
    const set1 = createComparatorSet([createComparator('=', v1)])
    const set2 = createComparatorSet([createComparator('=', v2)])
    const range = createRange([set1, set2])
    expect(formatRange(range)).toBe('1.0.0 || 2.0.0')
  })
})
