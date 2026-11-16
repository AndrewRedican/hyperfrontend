import { describe, expect, it } from '@hyperfrontend/testing'
import { ceilingOf, createComparator, createComparatorSet, createRange, createAnyRange, createExactRange, isWildcard } from './range'
import { createSemVer } from './version'

describe('createComparator', () => {
  it('creates a comparator with the given operator', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const c = createComparator('>=', v)
    expect(c.operator).toBe('>=')
  })

  it('creates a comparator that references the given version object', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const c = createComparator('>=', v)
    expect(c.version).toBe(v)
  })
})

describe('createComparatorSet', () => {
  it('creates a set of comparators', () => {
    const v1 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 2, minor: 0, patch: 0 })
    const set = createComparatorSet([createComparator('>=', v1), createComparator('<', v2)])
    expect(set.comparators).toHaveLength(2)
  })
})

describe('createRange', () => {
  it('creates a range with sets', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const set = createComparatorSet([createComparator('>=', v)])
    const range = createRange([set], '>=1.0.0')
    expect(range).toEqual({ sets: [set], raw: '>=1.0.0' })
  })
})

describe('createAnyRange', () => {
  it('creates a wildcard range', () => {
    const range = createAnyRange()
    expect(range).toEqual({ sets: [], raw: '*' })
  })
})

describe('createExactRange', () => {
  it('creates an exact match range', () => {
    const v = createSemVer({ major: 1, minor: 2, patch: 3 })
    const range = createExactRange(v)
    expect(range.sets).toEqual([
      expect.objectContaining({ comparators: expect.arrayContaining([expect.objectContaining({ operator: '=' })]) }),
    ])
  })
})

describe('isWildcard', () => {
  it('returns true for any range', () => {
    const range = createAnyRange()
    expect(isWildcard(range)).toBe(true)
  })

  it('returns false for specific range', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const range = createExactRange(v)
    expect(isWildcard(range)).toBe(false)
  })
})

describe('ceilingOf', () => {
  const CASES = [
    ['^', { major: 1, minor: 2, patch: 3 }, { major: 2, minor: 0, patch: 0 }],
    ['^', { major: 0, minor: 2, patch: 3 }, { major: 0, minor: 3, patch: 0 }],
    ['^', { major: 0, minor: 0, patch: 3 }, { major: 0, minor: 0, patch: 4 }],
    ['~', { major: 1, minor: 2, patch: 3 }, { major: 1, minor: 3, patch: 0 }],
    ['~', { major: 0, minor: 0, patch: 3 }, { major: 0, minor: 1, patch: 0 }],
  ] as const

  for (const [operator, version, ceiling] of CASES) {
    it(`ends the span of ${operator}${version.major}.${version.minor}.${version.patch} before ${ceiling.major}.${ceiling.minor}.${ceiling.patch}`, () => {
      expect(ceilingOf(operator, createSemVer(version))).toEqual(expect.objectContaining({ ...ceiling, prerelease: [] }))
    })
  }
})
