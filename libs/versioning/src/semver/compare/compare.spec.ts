import { describe, expect, it } from '@hyperfrontend/testing'
import { createComparator, createComparatorSet, createRange } from '../models/range'
import { createSemVer } from '../models/version'
import { parseRangeStrict } from '../parse/range'
import { parseVersionStrict } from '../parse/version'
import { compare, eq, lt, lte, gt, gte, neq, satisfies, satisfiesComparator, maxSatisfying, minSatisfying } from './compare'

describe('compare', () => {
  it('returns 0 for equal versions', () => {
    const a = createSemVer({ major: 1, minor: 2, patch: 3 })
    const b = createSemVer({ major: 1, minor: 2, patch: 3 })
    expect(compare(a, b)).toBe(0)
  })

  it('returns -1 when the first major version is lower', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 2, minor: 0, patch: 0 })
    expect(compare(a, b)).toBe(-1)
  })

  it('returns 1 when the first major version is higher', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 2, minor: 0, patch: 0 })
    expect(compare(b, a)).toBe(1)
  })

  it('compares minor versions', () => {
    const a = createSemVer({ major: 1, minor: 1, patch: 0 })
    const b = createSemVer({ major: 1, minor: 2, patch: 0 })
    expect(compare(a, b)).toBe(-1)
  })

  it('compares patch versions', () => {
    const a = createSemVer({ major: 1, minor: 1, patch: 1 })
    const b = createSemVer({ major: 1, minor: 1, patch: 2 })
    expect(compare(a, b)).toBe(-1)
  })

  it('ranks prerelease lower than release', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0 })
    expect(compare(a, b)).toBe(-1)
  })

  it('compares prerelease identifiers', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '2'] })
    expect(compare(a, b)).toBe(-1)
  })

  it('ranks numeric identifiers lower than alphanumeric', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['1'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    expect(compare(a, b)).toBe(-1)
  })
})

describe('comparison helpers', () => {
  const v1 = createSemVer({ major: 1, minor: 0, patch: 0 })
  const v2 = createSemVer({ major: 2, minor: 0, patch: 0 })
  const v1copy = createSemVer({ major: 1, minor: 0, patch: 0 })

  it('eq returns true for equal versions', () => {
    expect(eq(v1, v1copy)).toBe(true)
  })

  it('eq returns false for different versions', () => {
    expect(eq(v1, v2)).toBe(false)
  })

  it('lt returns true when the first version is lower', () => {
    expect(lt(v1, v2)).toBe(true)
  })

  it('lt returns false when the first version is higher', () => {
    expect(lt(v2, v1)).toBe(false)
  })

  it('lte returns true when the first version is lower', () => {
    expect(lte(v1, v2)).toBe(true)
  })

  it('lte returns true for equal versions', () => {
    expect(lte(v1, v1copy)).toBe(true)
  })

  it('lte returns false when the first version is higher', () => {
    expect(lte(v2, v1)).toBe(false)
  })

  it('gt returns true when the first version is higher', () => {
    expect(gt(v2, v1)).toBe(true)
  })

  it('gt returns false when the first version is lower', () => {
    expect(gt(v1, v2)).toBe(false)
  })

  it('gte returns true when the first version is higher', () => {
    expect(gte(v2, v1)).toBe(true)
  })

  it('gte returns true for equal versions', () => {
    expect(gte(v1, v1copy)).toBe(true)
  })

  it('gte returns false when the first version is lower', () => {
    expect(gte(v1, v2)).toBe(false)
  })

  it('neq returns true for different versions', () => {
    expect(neq(v1, v2)).toBe(true)
  })

  it('neq returns false for equal versions', () => {
    expect(neq(v1, v1copy)).toBe(false)
  })
})

describe('satisfies', () => {
  it('satisfies wildcard range', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const range = parseRangeStrict('*')
    expect(satisfies(v, range)).toBe(true)
  })

  it('satisfies exact match', () => {
    const v = createSemVer({ major: 1, minor: 2, patch: 3 })
    const range = parseRangeStrict('1.2.3')
    expect(satisfies(v, range)).toBe(true)
  })

  it('does not satisfy non-matching exact', () => {
    const v = createSemVer({ major: 1, minor: 2, patch: 3 })
    const range = parseRangeStrict('1.2.4')
    expect(satisfies(v, range)).toBe(false)
  })

  it('satisfies >= range', () => {
    const v = createSemVer({ major: 2, minor: 0, patch: 0 })
    const range = parseRangeStrict('>=1.0.0')
    expect(satisfies(v, range)).toBe(true)
  })

  it('satisfies caret range within the same major', () => {
    const v = createSemVer({ major: 1, minor: 5, patch: 0 })
    const range = parseRangeStrict('^1.0.0')
    expect(satisfies(v, range)).toBe(true)
  })

  it('does not satisfy caret range across a major bump', () => {
    const v = createSemVer({ major: 2, minor: 0, patch: 0 })
    const range = parseRangeStrict('^1.0.0')
    expect(satisfies(v, range)).toBe(false)
  })

  it('satisfies OR range', () => {
    const v = createSemVer({ major: 3, minor: 0, patch: 0 })
    const range = parseRangeStrict('1.0.0 || 3.0.0')
    expect(satisfies(v, range)).toBe(true)
  })
})

describe('maxSatisfying', () => {
  it('finds the maximum satisfying version', () => {
    const versions = [
      createSemVer({ major: 1, minor: 0, patch: 0 }),
      createSemVer({ major: 1, minor: 5, patch: 0 }),
      createSemVer({ major: 2, minor: 0, patch: 0 }),
    ]
    const range = parseRangeStrict('^1.0.0')
    const result = maxSatisfying(versions, range)
    expect(result).toEqual(createSemVer({ major: 1, minor: 5, patch: 0 }))
  })

  it('returns null if none satisfy', () => {
    const versions = [createSemVer({ major: 3, minor: 0, patch: 0 })]
    const range = parseRangeStrict('^1.0.0')
    expect(maxSatisfying(versions, range)).toBeNull()
  })
})

describe('minSatisfying', () => {
  it('finds the minimum satisfying version', () => {
    const versions = [
      createSemVer({ major: 1, minor: 0, patch: 0 }),
      createSemVer({ major: 1, minor: 5, patch: 0 }),
      createSemVer({ major: 2, minor: 0, patch: 0 }),
    ]
    const range = parseRangeStrict('>=1.0.0')
    const result = minSatisfying(versions, range)
    expect(result).toEqual(createSemVer({ major: 1, minor: 0, patch: 0 }))
  })
})

describe('compare - prerelease identifier edge cases', () => {
  it('ranks alphanumeric identifier higher than numeric', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['a'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['1'] })
    expect(compare(a, b)).toBe(1)
  })

  it('compares two numeric identifiers by value', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['2'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['10'] })
    expect(compare(a, b)).toBe(-1)
  })

  it('compares two alphanumeric identifiers lexically', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['beta'] })
    expect(compare(a, b)).toBe(-1)
  })

  it('returns 0 for equal alphanumeric identifiers', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['rc'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['rc'] })
    expect(compare(a, b)).toBe(0)
  })

  it('handles shorter prerelease array (lower precedence)', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] })
    expect(compare(a, b)).toBe(-1)
  })

  it('handles longer prerelease array (higher precedence)', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    expect(compare(a, b)).toBe(1)
  })

  it('compares larger numeric prerelease', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['10'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['2'] })
    expect(compare(a, b)).toBe(1)
  })

  it('compares alphanumeric greater than', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['beta'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    expect(compare(a, b)).toBe(1)
  })
})

describe('satisfies - operator edge cases', () => {
  it('handles > operator', () => {
    const v = createSemVer({ major: 2, minor: 0, patch: 0 })
    const range = parseRangeStrict('>1.0.0')
    expect(satisfies(v, range)).toBe(true)
  })

  it('fails > operator for equal version', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const range = parseRangeStrict('>1.0.0')
    expect(satisfies(v, range)).toBe(false)
  })

  it('handles < operator', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const range = parseRangeStrict('<2.0.0')
    expect(satisfies(v, range)).toBe(true)
  })

  it('handles <= operator', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const range = parseRangeStrict('<=1.0.0')
    expect(satisfies(v, range)).toBe(true)
  })

  it('handles tilde range', () => {
    const v = createSemVer({ major: 1, minor: 2, patch: 5 })
    const range = parseRangeStrict('~1.2.3')
    expect(satisfies(v, range)).toBe(true)
  })

  it('satisfies empty range (matches any version)', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    const range = parseRangeStrict('*')
    expect(satisfies(v, range)).toBe(true)
  })

  it('handles = operator', () => {
    const v = createSemVer({ major: 1, minor: 2, patch: 3 })
    const range = parseRangeStrict('=1.2.3')
    expect(satisfies(v, range)).toBe(true)
  })
})

describe('compare - prerelease deep comparison', () => {
  it('returns 1 when first prerelease identifier is larger', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['beta'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    expect(compare(a, b)).toBe(1)
  })

  it('returns -1 when first prerelease identifier is smaller', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['beta'] })
    expect(compare(a, b)).toBe(-1)
  })

  it('compares numerically when both prerelease identifiers are numeric', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['100'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['20'] })
    expect(compare(a, b)).toBe(1)
  })

  it('returns correct result for equal length prerelease with difference in middle', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '2', 'rc'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1', 'rc'] })
    expect(compare(a, b)).toBe(1)
  })

  it('compares prerelease identifiers at second position', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['rc', '5'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['rc', '3'] })
    expect(compare(a, b)).toBe(1)
  })

  it('compares prerelease where numeric value at second position differs', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['beta', '10'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['beta', '2'] })
    expect(compare(a, b)).toBe(1)
  })
})

describe('satisfies - or group edge cases', () => {
  it('satisfies when matching at least one OR group', () => {
    const v = createSemVer({ major: 3, minor: 0, patch: 0 })
    const range = parseRangeStrict('1.0.0 || 2.0.0 || 3.0.0')
    expect(satisfies(v, range)).toBe(true)
  })

  it('does not satisfy when matching none of OR groups', () => {
    const v = createSemVer({ major: 4, minor: 0, patch: 0 })
    const range = parseRangeStrict('1.0.0 || 2.0.0 || 3.0.0')
    expect(satisfies(v, range)).toBe(false)
  })
})

describe('satisfiesComparator - operator fallback', () => {
  it('handles caret operator as >= fallback', () => {
    const v1 = createSemVer({ major: 2, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const comp = createComparator('^', v2)
    expect(satisfiesComparator(v1, comp)).toBe(true)
  })

  it('handles tilde operator as >= fallback', () => {
    const v1 = createSemVer({ major: 2, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const comp = createComparator('~', v2)
    expect(satisfiesComparator(v1, comp)).toBe(true)
  })

  it('returns false for caret operator when version is lower', () => {
    const v1 = createSemVer({ major: 0, minor: 9, patch: 0 })
    const v2 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const comp = createComparator('^', v2)
    expect(satisfiesComparator(v1, comp)).toBe(false)
  })

  it('handles <= operator', () => {
    const v1 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const comp = createComparator('<=', v2)
    expect(satisfiesComparator(v1, comp)).toBe(true)
  })

  it('handles < operator when less than', () => {
    const v1 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 2, minor: 0, patch: 0 })
    const comp = createComparator('<', v2)
    expect(satisfiesComparator(v1, comp)).toBe(true)
  })

  it('returns false for < operator when equal', () => {
    const v1 = createSemVer({ major: 2, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 2, minor: 0, patch: 0 })
    const comp = createComparator('<', v2)
    expect(satisfiesComparator(v1, comp)).toBe(false)
  })

  it('returns false for unknown operator', () => {
    const v1 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const v2 = createSemVer({ major: 1, minor: 0, patch: 0 })
    const comp = createComparator('!!' as '>=', v2)
    expect(satisfiesComparator(v1, comp)).toBe(false)
  })
})

describe('compare - additional prerelease edge cases', () => {
  it('handles release vs prerelease with release first', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    expect(compare(a, b)).toBe(1)
  })

  it('compares equal numeric prerelease identifiers', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['5'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['5'] })
    expect(compare(a, b)).toBe(0)
  })

  it('handles identical prerelease with equal identifiers', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', 'beta', '1'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', 'beta', '1'] })
    expect(compare(a, b)).toBe(0)
  })
})

describe('satisfies - prerelease versions', () => {
  const CASES: readonly (readonly [string, string, boolean])[] = [
    ['1.0.0-alpha.6', '>=1.0.0-alpha.6', true],
    ['1.0.0-alpha.7', '>=1.0.0-alpha.6', true],
    ['1.0.0-alpha.5', '>=1.0.0-alpha.6', false],
    ['2.0.0-alpha.1', '>=1.0.0-alpha.6', false],
    ['1.0.1-alpha.1', '>=1.0.0-alpha.6', false],
    ['1.0.0', '>=1.0.0-alpha.6', true],
    ['2.0.0', '>=1.0.0-alpha.6', true],
    ['1.0.0-alpha.6', '1.0.0-alpha.6', true],
    ['1.0.0-alpha.7', '1.0.0-alpha.6', false],
    ['1.0.0', '1.0.0+build.7', true],
    ['1.0.0+build.8', '1.0.0+build.7', true],
    ['1.0.0-beta', '~1.0.0-alpha', true],
    ['1.0.1', '~1.0.0-alpha', true],
    ['1.0.1-beta', '~1.0.0-alpha', false],
    ['1.1.0-beta', '~1.0.0-alpha', false],
    ['1.0.0-alpha.2', '^1.0.0-alpha.1', true],
    ['1.5.0', '^1.0.0-alpha.1', true],
    ['1.5.0-beta', '^1.0.0-alpha.1', false],
    ['2.0.0-alpha', '^1.0.0-alpha.1', false],
    ['1.1.0-beta.1', '^1.0.0', false],
    ['1.0.0-beta', '1.0.0-alpha - 2.0.0-beta', true],
    ['2.0.0-alpha', '1.0.0-alpha - 2.0.0-beta', true],
    ['2.0.0-beta', '1.0.0-alpha - 2.0.0-beta', true],
    ['2.0.0-gamma', '1.0.0-alpha - 2.0.0-beta', false],
    ['1.5.0-rc', '1.0.0-alpha - 2.0.0-beta', false],
    ['1.5.0', '1.0.0-alpha - 2.0.0-beta', true],
    ['1.0.0-beta', '<1.0.0-rc', true],
    ['0.9.0-beta', '<1.0.0-rc', false],
    ['1.0.0-alpha', '<1.0.0', false],
    ['1.0.0-alpha', '<=1.0.0', false],
    ['1.0.0-alpha', '*', false],
    ['1.0.0-alpha', '>=0.0.0', false],
    ['1.0.0-alpha', '1.x', false],
    ['1.0.0-alpha', '>=1.0.0-0', true],
    ['1.0.0-alpha', '1.0.0-alpha || 2.0.0', true],
    ['2.0.0-alpha', '1.0.0-alpha || 2.0.0', false],
    ['1.0.0-alpha', '>=1.0.0-alpha <2.0.0', true],
    ['1.5.0-beta', '>=1.0.0-alpha <2.0.0', false],
    ['2.0.0-alpha', '>=1.0.0-alpha <2.0.0', false],
    ['2.0.0-alpha', '>=1.0.0-alpha <2.0.0-beta', true],
    ['1.0.0-alpha', '>1.0.0-alpha <1.0.0-beta', false],
    ['1.0.0-alpha.1', '>1.0.0-alpha <1.0.0-beta', true],
  ]

  for (const [version, range, expected] of CASES) {
    it(`${expected ? 'matches' : 'rejects'} ${version} against ${range}`, () => {
      expect(satisfies(parseVersionStrict(version), parseRangeStrict(range))).toBe(expected)
    })
  }

  it('treats a hand-built empty comparator set as a wildcard for a release', () => {
    const range = createRange([createComparatorSet([])])
    expect(satisfies(createSemVer({ major: 1, minor: 0, patch: 0 }), range)).toBe(true)
  })

  it('treats a hand-built empty comparator set as a wildcard for a prerelease', () => {
    const range = createRange([createComparatorSet([])])
    expect(satisfies(createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] }), range)).toBe(false)
  })

  const CANDIDATES = ['1.0.0-alpha.5', '1.0.0-alpha.6', '1.0.0-alpha.7', '1.0.0', '2.0.0-alpha.1'].map(parseVersionStrict)

  it('selects the highest admitted version in maxSatisfying', () => {
    expect(maxSatisfying(CANDIDATES, parseRangeStrict('>=1.0.0-alpha.6'))).toBe(CANDIDATES[3])
  })

  it('selects the lowest admitted version in minSatisfying', () => {
    expect(minSatisfying(CANDIDATES, parseRangeStrict('>=1.0.0-alpha.6'))).toBe(CANDIDATES[1])
  })
})
