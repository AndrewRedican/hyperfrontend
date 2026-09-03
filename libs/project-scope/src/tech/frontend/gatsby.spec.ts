import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { gatsbyDetector } from './gatsby'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('gatsbyDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when gatsby is not present', () => {
    const result = gatsbyDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects gatsby from package.json', () => {
    const pkg: PackageJson = {
      dependencies: { gatsby: '^5.0.0' },
    }
    const result = gatsbyDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('gatsby')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with gatsby-config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('gatsby-config.js')
    })

    const pkg: PackageJson = {
      dependencies: { gatsby: '^5.0.0' },
    }
    const result = gatsbyDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
    expect(result?.detectedFrom.some((s) => s.path === 'gatsby-config.*')).toBe(true)
  })

  it('increases confidence with gatsby-config.ts', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('gatsby-config.ts')
    })

    const pkg: PackageJson = {
      dependencies: { gatsby: '^5.0.0' },
    }
    const result = gatsbyDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('increases confidence with gatsby plugins', () => {
    const pkg: PackageJson = {
      dependencies: {
        gatsby: '^5.0.0',
        'gatsby-plugin-image': '^3.0.0',
        'gatsby-source-filesystem': '^5.0.0',
      },
    }
    const result = gatsbyDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies (gatsby plugins)')).toBe(true)
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('gatsby-config.js')
    })

    const pkg: PackageJson = {
      dependencies: {
        gatsby: '^5.0.0',
        'gatsby-plugin-image': '^3.0.0',
      },
    }
    const result = gatsbyDetector('/some/path', pkg)

    expect(result?.confidence).toBe(100)
  })
})
