import { describe, expect, it } from '@hyperfrontend/testing'
import { createSemVer } from '../models/version'
import { increment, incrementPrerelease, diff } from './bump'

describe('increment', () => {
  describe('major', () => {
    it('increments major and resets minor/patch', () => {
      const v = createSemVer({ major: 1, minor: 2, patch: 3 })
      const result = increment(v, 'major')
      expect(result.major).toBe(2)
      expect(result.minor).toBe(0)
      expect(result.patch).toBe(0)
      expect(result.prerelease).toEqual([])
    })
  })

  describe('minor', () => {
    it('increments minor and resets patch', () => {
      const v = createSemVer({ major: 1, minor: 2, patch: 3 })
      const result = increment(v, 'minor')
      expect(result.major).toBe(1)
      expect(result.minor).toBe(3)
      expect(result.patch).toBe(0)
    })
  })

  describe('patch', () => {
    it('increments patch', () => {
      const v = createSemVer({ major: 1, minor: 2, patch: 3 })
      const result = increment(v, 'patch')
      expect(result.major).toBe(1)
      expect(result.minor).toBe(2)
      expect(result.patch).toBe(4)
    })

    it('strips prerelease on patch bump', () => {
      const v = createSemVer({ major: 1, minor: 2, patch: 3, prerelease: ['alpha'] })
      const result = increment(v, 'patch')
      expect(result.patch).toBe(3)
      expect(result.prerelease).toEqual([])
    })
  })

  describe('premajor', () => {
    it('bumps major and adds prerelease', () => {
      const v = createSemVer({ major: 1, minor: 0, patch: 0 })
      const result = increment(v, 'premajor')
      expect(result.major).toBe(2)
      expect(result.prerelease[0]).toBe('alpha')
      expect(result.prerelease[1]).toBe('0')
    })

    it('uses custom prerelease id', () => {
      const v = createSemVer({ major: 1, minor: 0, patch: 0 })
      const result = increment(v, 'premajor', 'beta')
      expect(result.prerelease[0]).toBe('beta')
    })
  })

  describe('preminor', () => {
    it('bumps minor and adds prerelease', () => {
      const v = createSemVer({ major: 1, minor: 0, patch: 0 })
      const result = increment(v, 'preminor')
      expect(result.minor).toBe(1)
      expect(result.prerelease).toHaveLength(2)
    })
  })

  describe('prepatch', () => {
    it('bumps patch and adds prerelease', () => {
      const v = createSemVer({ major: 1, minor: 0, patch: 0 })
      const result = increment(v, 'prepatch')
      expect(result.patch).toBe(1)
      expect(result.prerelease).toHaveLength(2)
    })
  })

  describe('prerelease', () => {
    it('increments prerelease number', () => {
      const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] })
      const result = increment(v, 'prerelease')
      expect(result.prerelease).toEqual(['alpha', '2'])
    })

    it('adds prerelease to release version', () => {
      const v = createSemVer({ major: 1, minor: 0, patch: 0 })
      const result = increment(v, 'prerelease')
      expect(result.patch).toBe(1)
      expect(result.prerelease[0]).toBe('alpha')
    })
  })

  describe('none', () => {
    it('returns same version', () => {
      const v = createSemVer({ major: 1, minor: 2, patch: 3 })
      const result = increment(v, 'none')
      expect(result).toBe(v)
    })
  })
})

describe('incrementPrerelease', () => {
  it('increments numeric prerelease', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '5'] })
    const result = incrementPrerelease(v)
    expect(result.prerelease).toEqual(['alpha', '6'])
  })

  it('appends 0 to non-numeric prerelease', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const result = incrementPrerelease(v)
    expect(result.prerelease).toEqual(['alpha', '0'])
  })

  it('changes prerelease id if specified', () => {
    const v = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] })
    const result = incrementPrerelease(v, 'beta')
    expect(result.prerelease[0]).toBe('beta')
  })
})

describe('diff', () => {
  it('detects major difference', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 2, minor: 0, patch: 0 })
    expect(diff(a, b)).toBe('major')
  })

  it('detects minor difference', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 1, minor: 1, patch: 0 })
    expect(diff(a, b)).toBe('minor')
  })

  it('detects patch difference', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 1, minor: 0, patch: 1 })
    expect(diff(a, b)).toBe('patch')
  })

  it('detects prerelease difference', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['beta'] })
    expect(diff(a, b)).toBe('prerelease')
  })

  it('detects premajor', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 2, minor: 0, patch: 0, prerelease: ['alpha'] })
    expect(diff(a, b)).toBe('premajor')
  })

  it('returns null for equal versions', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 1, minor: 0, patch: 0 })
    expect(diff(a, b)).toBeNull()
  })

  it('detects preminor: minor bump with prerelease', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 1, minor: 1, patch: 0, prerelease: ['alpha', '0'] })
    expect(diff(a, b)).toBe('preminor')
  })

  it('detects prepatch: patch bump with prerelease', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0 })
    const b = createSemVer({ major: 1, minor: 0, patch: 1, prerelease: ['beta', '0'] })
    expect(diff(a, b)).toBe('prepatch')
  })

  it('detects prerelease length difference', () => {
    const a = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha'] })
    const b = createSemVer({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'] })
    expect(diff(a, b)).toBe('prerelease')
  })
})
