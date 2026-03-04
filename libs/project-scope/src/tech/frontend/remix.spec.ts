import type { PackageJson } from '../../project/package'
import * as fs from '../../core/fs'
import { remixDetector } from './remix'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

describe('remixDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when remix is not present', () => {
    const result = remixDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects remix from @remix-run/react', () => {
    const pkg: PackageJson = {
      dependencies: { '@remix-run/react': '^2.0.0' },
    }
    const result = remixDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('remix')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with @remix-run/node', () => {
    const pkg: PackageJson = {
      dependencies: {
        '@remix-run/react': '^2.0.0',
        '@remix-run/node': '^2.0.0',
      },
    }
    const result = remixDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.@remix-run/*')).toBe(true)
  })

  it('increases confidence with @remix-run/cloudflare', () => {
    const pkg: PackageJson = {
      dependencies: {
        '@remix-run/react': '^2.0.0',
        '@remix-run/cloudflare': '^2.0.0',
      },
    }
    const result = remixDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('increases confidence with @remix-run/deno', () => {
    const pkg: PackageJson = {
      dependencies: {
        '@remix-run/react': '^2.0.0',
        '@remix-run/deno': '^2.0.0',
      },
    }
    const result = remixDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('increases confidence with remix.config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('remix.config.js')
    })

    const pkg: PackageJson = {
      dependencies: { '@remix-run/react': '^2.0.0' },
    }
    const result = remixDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.path === 'remix.config.*')).toBe(true)
  })

  it('increases confidence with remix.config.ts', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('remix.config.ts')
    })

    const pkg: PackageJson = {
      dependencies: { '@remix-run/react': '^2.0.0' },
    }
    const result = remixDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })
})
