import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { detectFrontendFrameworks, frameworkDetectors } from './detect-all'

describe('detectFrontendFrameworks', () => {
  it('returns empty array for empty package.json', () => {
    const result = detectFrontendFrameworks('/non-existent', {})
    expect(result).toEqual([])
  })

  it('detects multiple frameworks', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        next: '^14.0.0',
      },
    }
    const result = detectFrontendFrameworks('/some/path', pkg)

    expect(result.map((framework) => framework.id)).toEqual(expect.arrayContaining(['react', 'nextjs']))
  })

  it('sorts results by confidence', () => {
    const pkg: PackageJson = {
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        next: '^14.0.0',
      },
    }
    const result = detectFrontendFrameworks('/some/path', pkg)

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence)
    }
  })
})

describe('frameworkDetectors', () => {
  it('exports array of all detectors', () => {
    expect(frameworkDetectors.map((detector) => detector.id)).toEqual([
      'react',
      'nextjs',
      'remix',
      'gatsby',
      'vue',
      'nuxt',
      'angular',
      'svelte',
      'sveltekit',
      'solid',
      'qwik',
      'astro',
    ])
  })

  it('each detector has required properties', () => {
    for (const detector of frameworkDetectors) {
      expect(detector).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          category: expect.any(String),
          detect: expect.any(Function),
        })
      )
    }
  })
})
