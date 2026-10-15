import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { qwikDetector } from './qwik'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

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

    expect(result).toEqual(expect.objectContaining({ id: 'qwik' }))
  })

  it('scores @builder.io/qwik at least 70', () => {
    const pkg: PackageJson = {
      dependencies: { '@builder.io/qwik': '^1.0.0' },
    }
    const result = qwikDetector('/some/path', pkg)

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
  })

  it('records @builder.io/qwik-city as a detection source', () => {
    const pkg: PackageJson = {
      dependencies: {
        '@builder.io/qwik': '^1.0.0',
        '@builder.io/qwik-city': '^1.0.0',
      },
    }
    const result = qwikDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.@builder.io/qwik-city' })]))
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
  })

  it('records qwik.config.ts as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('qwik.config.ts')
    })

    const pkg: PackageJson = {
      dependencies: { '@builder.io/qwik': '^1.0.0' },
    }
    const result = qwikDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'qwik.config.*' })]))
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
