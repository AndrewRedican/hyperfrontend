import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { sveltekitDetector } from './sveltekit'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

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

    expect(result).toEqual(expect.objectContaining({ id: 'sveltekit' }))
  })

  it('scores @sveltejs/kit at least 70', () => {
    const pkg: PackageJson = {
      devDependencies: { '@sveltejs/kit': '^2.0.0' },
    }
    const result = sveltekitDetector('/some/path', pkg)

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
  })

  it('records svelte.config.js as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('svelte.config.js')
    })

    const pkg: PackageJson = {
      devDependencies: { '@sveltejs/kit': '^2.0.0' },
    }
    const result = sveltekitDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'svelte.config.js' })]))
  })

  it('increases confidence with src/routes directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes(join('src', 'routes')) || path.endsWith('routes')
    })

    const pkg: PackageJson = {
      devDependencies: { '@sveltejs/kit': '^2.0.0' },
    }
    const result = sveltekitDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('records the src/routes directory as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes(join('src', 'routes')) || path.endsWith('routes')
    })

    const pkg: PackageJson = {
      devDependencies: { '@sveltejs/kit': '^2.0.0' },
    }
    const result = sveltekitDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/routes/' })]))
  })
})
