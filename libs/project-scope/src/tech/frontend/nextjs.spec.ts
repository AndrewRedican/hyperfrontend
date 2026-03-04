import type { PackageJson } from '../../project/package'
import * as fs from '../../core/fs'
import { nextjsDetector } from './nextjs'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

describe('nextjsDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when next.js is not present', () => {
    const result = nextjsDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects next.js from package.json', () => {
    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('nextjs')
    expect(result?.name).toBe('Next.js')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with next.config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('next.config.js')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
    expect(result?.detectedFrom.some((s) => s.path === 'next.config.*')).toBe(true)
  })

  it('increases confidence with next.config.mjs', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('next.config.mjs')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('increases confidence with next.config.ts', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('next.config.ts')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('increases confidence with pages directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith('/pages')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.path === 'pages/ or app/')).toBe(true)
  })

  it('increases confidence with app directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith('/app')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('increases confidence with src/pages directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('src/pages')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('increases confidence with src/app directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('src/app')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('caps confidence at 100', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('next.config.js') || path.endsWith('/pages')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBe(100)
  })
})
