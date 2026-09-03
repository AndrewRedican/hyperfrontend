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

    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.some((r) => r.id === 'react')).toBe(true)
    expect(result.some((r) => r.id === 'nextjs')).toBe(true)
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
    expect(frameworkDetectors).toBeInstanceOf(Array)
    expect(frameworkDetectors.length).toBe(12)
  })

  it('each detector has required properties', () => {
    for (const detector of frameworkDetectors) {
      expect(detector.id).toBeDefined()
      expect(detector.name).toBeDefined()
      expect(detector.category).toBeDefined()
      expect(typeof detector.detect).toBe('function')
    }
  })
})
