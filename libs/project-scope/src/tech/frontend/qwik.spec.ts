import type { PackageJson } from '../../project/package'
import * as fs from '../../core/fs'
import { qwikDetector } from './qwik'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

describe('qwikDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when qwik is not present', () => {
    const result = qwikDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects qwik from @builder.io/qwik', () => {
    const pkg: PackageJson = {
      dependencies: { '@builder.io/qwik': '^1.0.0' },
    }
    const result = qwikDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('qwik')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with @builder.io/qwik-city', () => {
    const pkg: PackageJson = {
      dependencies: {
        '@builder.io/qwik': '^1.0.0',
        '@builder.io/qwik-city': '^1.0.0',
      },
    }
    const result = qwikDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.@builder.io/qwik-city')).toBe(true)
  })

  it('increases confidence with qwik.config.ts', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('qwik.config.ts')
    })

    const pkg: PackageJson = {
      dependencies: { '@builder.io/qwik': '^1.0.0' },
    }
    const result = qwikDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.path === 'qwik.config.*')).toBe(true)
  })

  it('increases confidence with qwik.config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('qwik.config.js')
    })

    const pkg: PackageJson = {
      dependencies: { '@builder.io/qwik': '^1.0.0' },
    }
    const result = qwikDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })
})
