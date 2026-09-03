import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { reactDetector } from './react'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('reactDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when react is not present', () => {
    const result = reactDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects react from package.json', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('react')
    expect(result?.name).toBe('React')
    expect(result?.version).toBe('18.0.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('increases confidence with react-dom', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.react-dom')).toBe(true)
  })

  it('increases confidence with react-native', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        'react-native': '^0.72.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.react-native')).toBe(true)
  })

  it('increases confidence with JSX/TSX files', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('App.tsx') || path.includes('App.jsx')
    })

    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
    expect(result?.detectedFrom.some((s) => s.path === 'src/*.tsx or src/*.jsx')).toBe(true)
  })

  it('detects Next.js meta-framework', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        next: '^14.0.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.metaFrameworks).toBeDefined()
    expect(result?.metaFrameworks?.some((m) => m.id === 'nextjs')).toBe(true)
  })

  it('detects Gatsby meta-framework', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        gatsby: '^5.0.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.metaFrameworks?.some((m) => m.id === 'gatsby')).toBe(true)
  })

  it('detects Remix meta-framework', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        '@remix-run/react': '^2.0.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.metaFrameworks?.some((m) => m.id === 'remix')).toBe(true)
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('App.tsx')
    })

    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })
})
