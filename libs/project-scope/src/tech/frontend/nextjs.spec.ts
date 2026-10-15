import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { join, sep } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { nextjsDetector } from './nextjs'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

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

    expect(result).toEqual(expect.objectContaining({ id: 'nextjs', name: 'Next.js' }))
  })

  it('scores a next dependency at least 70', () => {
    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

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
  })

  it('records next.config.js as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('next.config.js')
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'next.config.*' })]))
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
      return path.endsWith(`${sep}pages`)
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('records the pages directory as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith(`${sep}pages`)
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'pages/ or app/' })]))
  })

  it('increases confidence with app directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith(`${sep}app`)
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('increases confidence with src/pages directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes(join('src', 'pages'))
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('increases confidence with src/app directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes(join('src', 'app'))
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('caps confidence at 100', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('next.config.js') || path.endsWith(`${sep}pages`)
    })

    const pkg: PackageJson = {
      dependencies: { next: '^14.0.0' },
    }
    const result = nextjsDetector('/some/path', pkg)

    expect(result?.confidence).toBe(100)
  })
})
