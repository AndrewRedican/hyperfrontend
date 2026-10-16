import { describe, expect, it } from '@hyperfrontend/testing'
import { createSemVer, createInitialVersion, createFirstRelease, isPrerelease, isStable, stripBuild, stripPrerelease } from './version'

describe('createSemVer', () => {
  it('creates a basic version', () => {
    const v = createSemVer({ major: 1, minor: 2, patch: 3 })
    expect(v).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] })
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
    expect(v).toEqual({ major: 0, minor: 0, patch: 0, prerelease: [], build: [] })
  })
})

describe('createFirstRelease', () => {
  it('creates 1.0.0', () => {
    const v = createFirstRelease()
    expect(v).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [], build: [] })
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
    expect(stripped).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [], build: [] })
  })
})

describe('stripPrerelease', () => {
  it('removes prerelease identifiers', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const stripped = stripPrerelease(v)
    expect(stripped).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [], build: [] })
  })
})
