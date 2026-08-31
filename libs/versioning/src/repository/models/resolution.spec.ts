import { describe, expect, it } from '@hyperfrontend/testing'
import {
  createDisabledResolution,
  createExplicitResolution,
  createInferredResolution,
  isRepositoryResolution,
  DEFAULT_INFERENCE_ORDER,
} from './resolution'

describe('createDisabledResolution', () => {
  it('creates a disabled resolution', () => {
    const resolution = createDisabledResolution()

    expect(resolution.mode).toBe('disabled')
    expect(resolution.repository).toBeUndefined()
    expect(resolution.inferenceOrder).toBeUndefined()
  })
})

describe('createExplicitResolution', () => {
  it('creates an explicit resolution with repository config', () => {
    const repository = {
      platform: 'github',
      baseUrl: 'https://github.com/owner/repo',
    } as const

    const resolution = createExplicitResolution(repository)

    expect(resolution.mode).toBe('explicit')
    expect(resolution.repository).toBe(repository)
    expect(resolution.inferenceOrder).toBeUndefined()
  })

  it('preserves the repository config exactly', () => {
    const formatter = (from: string, to: string) => `${from}-${to}`
    const repository = {
      platform: 'custom',
      baseUrl: 'https://custom.com',
      formatCompareUrl: formatter,
    } as const

    const resolution = createExplicitResolution(repository)

    expect(resolution.repository?.platform).toBe('custom')
    expect(resolution.repository?.formatCompareUrl).toBe(formatter)
  })
})

describe('createInferredResolution', () => {
  it('creates an inferred resolution with default order', () => {
    const resolution = createInferredResolution()

    expect(resolution.mode).toBe('inferred')
    expect(resolution.inferenceOrder).toEqual(['package-json', 'git-remote'])
    expect(resolution.repository).toBeUndefined()
  })

  it('creates an inferred resolution with custom order', () => {
    const resolution = createInferredResolution(['git-remote', 'package-json'])

    expect(resolution.mode).toBe('inferred')
    expect(resolution.inferenceOrder).toEqual(['git-remote', 'package-json'])
  })

  it('accepts single source order', () => {
    const resolution = createInferredResolution(['package-json'])

    expect(resolution.inferenceOrder).toEqual(['package-json'])
  })

  it('accepts git-remote only', () => {
    const resolution = createInferredResolution(['git-remote'])

    expect(resolution.inferenceOrder).toEqual(['git-remote'])
  })
})

describe('DEFAULT_INFERENCE_ORDER', () => {
  it('has package-json first', () => {
    expect(DEFAULT_INFERENCE_ORDER[0]).toBe('package-json')
  })

  it('has git-remote second', () => {
    expect(DEFAULT_INFERENCE_ORDER[1]).toBe('git-remote')
  })

  it('has exactly 2 sources', () => {
    expect(DEFAULT_INFERENCE_ORDER).toHaveLength(2)
  })
})

describe('isRepositoryResolution', () => {
  describe('valid resolutions', () => {
    it('returns true for disabled mode', () => {
      expect(isRepositoryResolution({ mode: 'disabled' })).toBe(true)
    })

    it('returns true for explicit mode', () => {
      expect(
        isRepositoryResolution({
          mode: 'explicit',
          repository: { platform: 'github', baseUrl: 'https://github.com/o/r' },
        })
      ).toBe(true)
    })

    it('returns true for inferred mode', () => {
      expect(
        isRepositoryResolution({
          mode: 'inferred',
          inferenceOrder: ['package-json'],
        })
      ).toBe(true)
    })

    it('returns true for resolution created by createDisabledResolution', () => {
      expect(isRepositoryResolution(createDisabledResolution())).toBe(true)
    })

    it('returns true for resolution created by createExplicitResolution', () => {
      const resolution = createExplicitResolution({
        platform: 'github',
        baseUrl: 'https://github.com/o/r',
      })
      expect(isRepositoryResolution(resolution)).toBe(true)
    })

    it('returns true for resolution created by createInferredResolution', () => {
      expect(isRepositoryResolution(createInferredResolution())).toBe(true)
    })

    it('returns true for explicit mode without repository', () => {
      expect(isRepositoryResolution({ mode: 'explicit' })).toBe(true)
    })

    it('returns true for inferred mode without inferenceOrder', () => {
      expect(isRepositoryResolution({ mode: 'inferred' })).toBe(true)
    })
  })

  describe('invalid values', () => {
    it('returns false for null', () => {
      expect(isRepositoryResolution(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isRepositoryResolution(undefined)).toBe(false)
    })

    it('returns false for string', () => {
      expect(isRepositoryResolution('disabled')).toBe(false)
    })

    it('returns false for number', () => {
      expect(isRepositoryResolution(123)).toBe(false)
    })

    it('returns false for array', () => {
      expect(isRepositoryResolution(['disabled'])).toBe(false)
    })

    it('returns false for empty object', () => {
      expect(isRepositoryResolution({})).toBe(false)
    })

    it('returns false for object without mode', () => {
      expect(
        isRepositoryResolution({
          repository: { platform: 'github', baseUrl: 'https://...' },
        })
      ).toBe(false)
    })

    it('returns false for invalid mode value', () => {
      expect(isRepositoryResolution({ mode: 'auto' })).toBe(false)
    })

    it('returns false for mode as number', () => {
      expect(isRepositoryResolution({ mode: 1 })).toBe(false)
    })

    it('returns false for mode as null', () => {
      expect(isRepositoryResolution({ mode: null })).toBe(false)
    })
  })
})
