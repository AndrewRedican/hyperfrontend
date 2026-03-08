import type { PackageJson } from '../../project/package'
import * as fs from '../../core/fs'
import { sveltekitDetector } from './sveltekit'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

describe('sveltekitDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when sveltekit is not present', () => {
    const result = sveltekitDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects sveltekit from @sveltejs/kit', () => {
    const pkg: PackageJson = {
      devDependencies: { '@sveltejs/kit': '^2.0.0' },
    }
    const result = sveltekitDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('sveltekit')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with svelte.config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('svelte.config.js')
    })

    const pkg: PackageJson = {
      devDependencies: { '@sveltejs/kit': '^2.0.0' },
    }
    const result = sveltekitDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.detectedFrom.some((s) => s.path === 'svelte.config.js')).toBe(true)
  })

  it('increases confidence with src/routes directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('src/routes') || path.endsWith('routes')
    })

    const pkg: PackageJson = {
      devDependencies: { '@sveltejs/kit': '^2.0.0' },
    }
    const result = sveltekitDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.path === 'src/routes/')).toBe(true)
  })
})
