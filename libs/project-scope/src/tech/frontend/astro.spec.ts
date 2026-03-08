import type { PackageJson } from '../../project/package'
import * as fs from '../../core/fs'
import { astroDetector } from './astro'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

describe('astroDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when astro is not present', () => {
    const result = astroDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects astro from package.json', () => {
    const pkg: PackageJson = {
      dependencies: { astro: '^4.0.0' },
    }
    const result = astroDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('astro')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with astro.config.mjs', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('astro.config.mjs')
    })

    const pkg: PackageJson = {
      dependencies: { astro: '^4.0.0' },
    }
    const result = astroDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
    expect(result?.detectedFrom.some((s) => s.path === 'astro.config.*')).toBe(true)
  })

  it('increases confidence with astro.config.ts', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('astro.config.ts')
    })

    const pkg: PackageJson = {
      dependencies: { astro: '^4.0.0' },
    }
    const result = astroDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('increases confidence with src/pages directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('src/pages') || path.endsWith('pages')
    })

    const pkg: PackageJson = {
      dependencies: { astro: '^4.0.0' },
    }
    const result = astroDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.path === 'src/pages/')).toBe(true)
  })
})
