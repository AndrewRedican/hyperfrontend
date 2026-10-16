import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { astroDetector } from './astro'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

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

    expect(result).toEqual(expect.objectContaining({ id: 'astro' }))
  })

  it('scores an astro dependency at least 70', () => {
    const pkg: PackageJson = {
      dependencies: { astro: '^4.0.0' },
    }
    const result = astroDetector('/some/path', pkg)

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
  })

  it('records astro.config.mjs as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('astro.config.mjs')
    })

    const pkg: PackageJson = {
      dependencies: { astro: '^4.0.0' },
    }
    const result = astroDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'astro.config.*' })]))
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
      return path.includes(join('src', 'pages')) || path.endsWith('pages')
    })

    const pkg: PackageJson = {
      dependencies: { astro: '^4.0.0' },
    }
    const result = astroDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('records the src/pages directory as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes(join('src', 'pages')) || path.endsWith('pages')
    })

    const pkg: PackageJson = {
      dependencies: { astro: '^4.0.0' },
    }
    const result = astroDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/pages/' })]))
  })
})
