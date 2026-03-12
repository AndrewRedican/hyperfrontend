import { createSemVer, createInitialVersion, createFirstRelease, isPrerelease, isStable, stripBuild, stripPrerelease } from './version'

describe('createSemVer', () => {
  it('creates a basic version', () => {
    const v = createSemVer({ major: 1, minor: 2, patch: 3 })
    expect(v.major).toBe(1)
    expect(v.minor).toBe(2)
    expect(v.patch).toBe(3)
    expect(v.prerelease).toEqual([])
    expect(v.build).toEqual([])
  })

  it('creates a version with prerelease', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] })
    expect(v.prerelease).toEqual(['alpha', '1'])
  })

  it('creates a version with build metadata', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, build: ['build', '123'] })
    expect(v.build).toEqual(['build', '123'])
  })

  it('stores raw string', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, raw: '1.0.0' })
    expect(v.raw).toBe('1.0.0')
  })
})

describe('createInitialVersion', () => {
  it('creates 0.0.0', () => {
    const v = createInitialVersion()
    expect(v.major).toBe(0)
    expect(v.minor).toBe(0)
    expect(v.patch).toBe(0)
  })
})

describe('createFirstRelease', () => {
  it('creates 1.0.0', () => {
    const v = createFirstRelease()
    expect(v.major).toBe(1)
    expect(v.minor).toBe(0)
    expect(v.patch).toBe(0)
  })
})

describe('isPrerelease', () => {
  it('returns true for prerelease versions', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    expect(isPrerelease(v)).toBe(true)
  })

  it('returns false for release versions', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    expect(isPrerelease(v)).toBe(false)
  })
})

describe('isStable', () => {
  it('returns true for 1.0.0', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0 })
    expect(isStable(v)).toBe(true)
  })

  it('returns false for 0.x.x', () => {
    const v = createSemVer({ major: 0, minor: 9, patch: 0 })
    expect(isStable(v)).toBe(false)
  })

  it('returns false for prerelease', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['rc', '1'] })
    expect(isStable(v)).toBe(false)
  })
})

describe('stripBuild', () => {
  it('removes build metadata', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, build: ['123'] })
    const stripped = stripBuild(v)
    expect(stripped.build).toEqual([])
    expect(stripped.major).toBe(1)
  })
})

describe('stripPrerelease', () => {
  it('removes prerelease identifiers', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const stripped = stripPrerelease(v)
    expect(stripped.prerelease).toEqual([])
    expect(stripped.major).toBe(1)
  })
})
