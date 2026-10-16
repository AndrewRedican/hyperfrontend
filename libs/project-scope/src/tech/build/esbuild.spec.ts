import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { esbuildDetector } from './esbuild'

describe('esbuildDetector', () => {
  it('returns null when esbuild is not present', () => {
    const result = esbuildDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects esbuild from package.json', () => {
    const pkg: PackageJson = {
      devDependencies: { esbuild: '^0.19.0' },
    }
    const result = esbuildDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'esbuild', name: 'esbuild' }))
  })

  it('scores an esbuild dependency at least 70', () => {
    const pkg: PackageJson = {
      devDependencies: { esbuild: '^0.19.0' },
    }
    const result = esbuildDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with esbuild plugins', () => {
    const pkg: PackageJson = {
      devDependencies: {
        esbuild: '^0.19.0',
        'esbuild-plugin-copy': '^2.0.0',
      },
    }
    const result = esbuildDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(85)
  })

  it('records esbuild plugins as a detection source', () => {
    const pkg: PackageJson = {
      devDependencies: {
        esbuild: '^0.19.0',
        'esbuild-plugin-copy': '^2.0.0',
      },
    }
    const result = esbuildDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies (esbuild plugins)' })]))
  })

  it('increases confidence with esbuild- prefix plugins', () => {
    const pkg: PackageJson = {
      devDependencies: {
        esbuild: '^0.19.0',
        'esbuild-sass-plugin': '^2.0.0',
      },
    }
    const result = esbuildDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(85)
  })

  it('increases confidence with esbuild scripts', () => {
    const pkg: PackageJson = {
      devDependencies: { esbuild: '^0.19.0' },
      scripts: {
        build: 'esbuild src/index.ts --bundle --outfile=dist/index.js',
      },
    }
    const result = esbuildDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('records an esbuild build script as a detection source', () => {
    const pkg: PackageJson = {
      devDependencies: { esbuild: '^0.19.0' },
      scripts: {
        build: 'esbuild src/index.ts --bundle --outfile=dist/index.js',
      },
    }
    const result = esbuildDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'scripts.build' })]))
  })

  it('has maximum confidence with all indicators', () => {
    const pkg: PackageJson = {
      devDependencies: {
        esbuild: '^0.19.0',
        'esbuild-plugin-copy': '^2.0.0',
        'esbuild-sass-plugin': '^2.0.0',
      },
      scripts: {
        build: 'esbuild src/index.ts --bundle',
        dev: 'esbuild src/index.ts --watch',
      },
    }
    const result = esbuildDetector('/some/path', pkg)

    expect(result?.confidence).toBe(100)
  })
})
