import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { solidDetector } from './solid'

describe('solidDetector', () => {
  it('returns null when solid is not present', () => {
    const result = solidDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects solid-js from package.json', () => {
    const pkg: PackageJson = {
      dependencies: { 'solid-js': '^1.0.0' },
    }
    const result = solidDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'solid' }))
  })

  it('scores a solid-js dependency at least 70', () => {
    const pkg: PackageJson = {
      dependencies: { 'solid-js': '^1.0.0' },
    }
    const result = solidDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with vite-plugin-solid', () => {
    const pkg: PackageJson = {
      dependencies: { 'solid-js': '^1.0.0' },
      devDependencies: { 'vite-plugin-solid': '^2.0.0' },
    }
    const result = solidDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('records vite-plugin-solid as a detection source', () => {
    const pkg: PackageJson = {
      dependencies: { 'solid-js': '^1.0.0' },
      devDependencies: { 'vite-plugin-solid': '^2.0.0' },
    }
    const result = solidDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.vite-plugin-solid' })]))
  })

  it('increases confidence with solid-start', () => {
    const pkg: PackageJson = {
      dependencies: {
        'solid-js': '^1.0.0',
        'solid-start': '^0.3.0',
      },
    }
    const result = solidDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('records solid-start as a detection source', () => {
    const pkg: PackageJson = {
      dependencies: {
        'solid-js': '^1.0.0',
        'solid-start': '^0.3.0',
      },
    }
    const result = solidDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.solid-start' })]))
  })

  it('increases confidence with @solidjs/start', () => {
    const pkg: PackageJson = {
      dependencies: {
        'solid-js': '^1.0.0',
        '@solidjs/start': '^1.0.0',
      },
    }
    const result = solidDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })
})
