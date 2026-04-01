import type { PackageJson } from '../../project/package'
import { resolve } from 'node:path'
import { detectBuildTools, buildToolDetectors } from './detect-all'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

describe('detectBuildTools', () => {
  it('returns empty array for empty package.json', () => {
    const result = detectBuildTools('/non-existent', {})
    expect(result).toEqual([])
  })

  it('detects multiple build tools', () => {
    const pkg: PackageJson = {
      devDependencies: {
        webpack: '^5.0.0',
        '@babel/core': '^7.0.0',
      },
    }
    const result = detectBuildTools('/some/path', pkg)

    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.some((r) => r.id === 'webpack')).toBe(true)
    expect(result.some((r) => r.id === 'babel')).toBe(true)
  })

  it('sorts results by confidence', () => {
    const pkg: PackageJson = {
      devDependencies: {
        webpack: '^5.0.0',
        esbuild: '^0.19.0',
      },
    }
    const result = detectBuildTools('/some/path', pkg)

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence)
    }
  })

  it('detects typescript fixture with no build tools other than what minimal project has', () => {
    const result = detectBuildTools(MINIMAL_PROJECT)

    const majorBundlers = result.filter((r) =>
      ['webpack', 'vite', 'rollup', 'parcel'].includes(r.id)
    )
    expect(majorBundlers.length).toBe(0)
  })
})

describe('buildToolDetectors', () => {
  it('exports array of all detectors', () => {
    expect(buildToolDetectors).toBeInstanceOf(Array)
    expect(buildToolDetectors.length).toBe(7)
  })

  it('each detector has required properties', () => {
    for (const detector of buildToolDetectors) {
      expect(detector.id).toBeDefined()
      expect(detector.name).toBeDefined()
      expect(typeof detector.detect).toBe('function')
    }
  })
})
