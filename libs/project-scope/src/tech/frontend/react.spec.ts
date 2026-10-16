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

    expect(result).toEqual(expect.objectContaining({ id: 'react', name: 'React', version: '18.0.0' }))
  })

  it('scores a react dependency at least 60', () => {
    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
    }
    const result = reactDetector('/some/path', pkg)

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
  })

  it('records react-dom as a detection source', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.react-dom' })]))
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
  })

  it('records react-native as a detection source', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        'react-native': '^0.72.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.react-native' })]))
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
  })

  it('records JSX/TSX files as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('App.tsx') || path.includes('App.jsx')
    })

    const pkg: PackageJson = {
      dependencies: { react: '^18.0.0' },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/*.tsx or src/*.jsx' })]))
  })

  it('detects Next.js meta-framework', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        next: '^14.0.0',
      },
    }
    const result = reactDetector('/some/path', pkg)

    expect(result?.metaFrameworks).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'nextjs' })]))
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
