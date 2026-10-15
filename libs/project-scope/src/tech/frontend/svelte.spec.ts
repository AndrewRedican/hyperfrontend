import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { svelteDetector } from './svelte'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('svelteDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when svelte is not present', () => {
    const result = svelteDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects svelte from package.json', () => {
    const pkg: PackageJson = {
      devDependencies: { svelte: '^4.0.0' },
    }
    const result = svelteDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'svelte' }))
  })

  it('scores a svelte dependency at least 70', () => {
    const pkg: PackageJson = {
      devDependencies: { svelte: '^4.0.0' },
    }
    const result = svelteDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects SvelteKit meta-framework', () => {
    const pkg: PackageJson = {
      devDependencies: {
        svelte: '^4.0.0',
        '@sveltejs/kit': '^2.0.0',
      },
    }
    const result = svelteDetector('/some/path', pkg)

    expect(result?.metaFrameworks?.some((m) => m.id === 'sveltekit')).toBe(true)
  })

  it('increases confidence with svelte.config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('svelte.config.js')
    })

    const pkg: PackageJson = {
      devDependencies: { svelte: '^4.0.0' },
    }
    const result = svelteDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('records svelte.config.js as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('svelte.config.js')
    })

    const pkg: PackageJson = {
      devDependencies: { svelte: '^4.0.0' },
    }
    const result = svelteDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'svelte.config.js' })]))
  })

  it('increases confidence with .svelte files in src', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('App.svelte') || path.includes(join('src', 'routes'))
    })

    const pkg: PackageJson = {
      devDependencies: { svelte: '^4.0.0' },
    }
    const result = svelteDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('records .svelte files in src as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('App.svelte') || path.includes(join('src', 'routes'))
    })

    const pkg: PackageJson = {
      devDependencies: { svelte: '^4.0.0' },
    }
    const result = svelteDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/*.svelte or src/routes/' })]))
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('svelte.config.js') || path.includes('App.svelte')
    })

    const pkg: PackageJson = {
      devDependencies: { svelte: '^4.0.0' },
    }
    const result = svelteDetector('/some/path', pkg)

    expect(result?.confidence).toBe(100)
  })
})
