import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { sep } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { nuxtDetector } from './nuxt'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('nuxtDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when nuxt is not present', () => {
    const result = nuxtDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects nuxt from package.json', () => {
    const pkg: PackageJson = {
      dependencies: { nuxt: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'nuxt' }))
  })

  it('scores a nuxt dependency at least 70', () => {
    const pkg: PackageJson = {
      dependencies: { nuxt: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects nuxt3 from package.json', () => {
    const pkg: PackageJson = {
      dependencies: { nuxt3: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'nuxt', version: '3.0.0' }))
  })

  it('increases confidence with nuxt.config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('nuxt.config.js')
    })

    const pkg: PackageJson = {
      dependencies: { nuxt: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('records nuxt.config.js as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('nuxt.config.js')
    })

    const pkg: PackageJson = {
      dependencies: { nuxt: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'nuxt.config.*' })]))
  })

  it('increases confidence with nuxt.config.ts', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('nuxt.config.ts')
    })

    const pkg: PackageJson = {
      dependencies: { nuxt: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('increases confidence with pages directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith(`${sep}pages`)
    })

    const pkg: PackageJson = {
      dependencies: { nuxt: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('records the pages directory as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith(`${sep}pages`)
    })

    const pkg: PackageJson = {
      dependencies: { nuxt: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'pages/' })]))
  })

  it('caps confidence at 100', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('nuxt.config.js') || path.endsWith(`${sep}pages`)
    })

    const pkg: PackageJson = {
      dependencies: { nuxt: '^3.0.0' },
    }
    const result = nuxtDetector('/some/path', pkg)

    expect(result?.confidence).toBe(100)
  })
})
