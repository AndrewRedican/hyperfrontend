import { createSemVer } from '../models/version'
import { sort, sortDescending, max, min } from './sort'

describe('sort', () => {
  it('sorts versions ascending', () => {
    const versions = [
      createSemVer({ major: 2, minor: 0, patch: 0 }),
      createSemVer({ major: 1, minor: 0, patch: 0 }),
      createSemVer({ major: 3, minor: 0, patch: 0 }),
    ]
    const sorted = sort(versions)
    expect(sorted[0].major).toBe(1)
    expect(sorted[1].major).toBe(2)
    expect(sorted[2].major).toBe(3)
  })

  it('does not mutate original array', () => {
    const versions = [createSemVer({ major: 2, minor: 0, patch: 0 }), createSemVer({ major: 1, minor: 0, patch: 0 })]
    sort(versions)
    expect(versions[0].major).toBe(2)
  })
})

describe('sortDescending', () => {
  it('sorts versions descending', () => {
    const versions = [
      createSemVer({ major: 1, minor: 0, patch: 0 }),
      createSemVer({ major: 3, minor: 0, patch: 0 }),
      createSemVer({ major: 2, minor: 0, patch: 0 }),
    ]
    const sorted = sortDescending(versions)
    expect(sorted[0].major).toBe(3)
    expect(sorted[1].major).toBe(2)
    expect(sorted[2].major).toBe(1)
  })
})

describe('max', () => {
  it('finds the maximum version', () => {
    const versions = [
      createSemVer({ major: 1, minor: 0, patch: 0 }),
      createSemVer({ major: 3, minor: 0, patch: 0 }),
      createSemVer({ major: 2, minor: 0, patch: 0 }),
    ]
    expect(max(versions)?.major).toBe(3)
  })

  it('returns null for empty array', () => {
    expect(max([])).toBeNull()
  })
})

describe('min', () => {
  it('finds the minimum version', () => {
    const versions = [
      createSemVer({ major: 2, minor: 0, patch: 0 }),
      createSemVer({ major: 1, minor: 0, patch: 0 }),
      createSemVer({ major: 3, minor: 0, patch: 0 }),
    ]
    expect(min(versions)?.major).toBe(1)
  })

  it('returns null for empty array', () => {
    expect(min([])).toBeNull()
  })
})
