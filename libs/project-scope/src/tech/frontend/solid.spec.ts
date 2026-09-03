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

    expect(result).not.toBeNull()
    expect(result?.id).toBe('solid')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with vite-plugin-solid', () => {
    const pkg: PackageJson = {
      dependencies: { 'solid-js': '^1.0.0' },
      devDependencies: { 'vite-plugin-solid': '^2.0.0' },
    }
    const result = solidDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.vite-plugin-solid')).toBe(true)
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
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.solid-start')).toBe(true)
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
