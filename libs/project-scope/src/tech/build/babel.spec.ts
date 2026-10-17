import type { PackageJson } from '../../project/package'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as detectorHelpers from '../shared-utils/detector-helpers'
import { babelDetector, BABEL_CONFIG_PATTERNS } from './babel'

jest.mock('../shared-utils/detector-helpers', () => ({
  ...jest.requireActual<typeof import('../shared-utils/detector-helpers')>('../shared-utils/detector-helpers'),
  locateConfigFile: jest.fn().mockReturnValue(null),
}))

describe('babelDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exports BABEL_CONFIG_PATTERNS', () => {
    expect(BABEL_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['babel.config.js', '.babelrc']))
  })

  it('returns null when babel is not present', () => {
    const result = babelDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects babel from @babel/core', () => {
    const pkg: PackageJson = {
      devDependencies: { '@babel/core': '^7.0.0' },
    }
    const result = babelDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'babel', name: 'Babel', version: '7.0.0' }))
  })

  it('scores @babel/core at least 50', () => {
    const pkg: PackageJson = {
      devDependencies: { '@babel/core': '^7.0.0' },
    }
    const result = babelDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(50)
  })

  it('detects babel config in package.json', () => {
    const pkg: PackageJson = {
      devDependencies: { '@babel/core': '^7.0.0' },
      babel: { presets: ['@babel/preset-env'] },
    }
    const result = babelDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'babel' })]))
  })

  it('increases confidence with babel config in package.json', () => {
    const pkg: PackageJson = {
      devDependencies: { '@babel/core': '^7.0.0' },
      babel: { presets: ['@babel/preset-env'] },
    }
    const result = babelDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('detects babel from config file', () => {
    jest.mocked(detectorHelpers.locateConfigFile).mockReturnValueOnce('/project/babel.config.js')

    const pkg: PackageJson = {
      devDependencies: { '@babel/core': '^7.0.0' },
    }
    const result = babelDetector('/project', pkg)

    expect(result).toEqual(
      expect.objectContaining({
        configPath: '/project/babel.config.js',
        detectedFrom: expect.arrayContaining([expect.objectContaining({ type: 'config-file' })]),
      })
    )
  })

  it('increases confidence with a babel config file', () => {
    jest.mocked(detectorHelpers.locateConfigFile).mockReturnValueOnce('/project/babel.config.js')

    const pkg: PackageJson = {
      devDependencies: { '@babel/core': '^7.0.0' },
    }
    const result = babelDetector('/project', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('detects @babel packages', () => {
    const pkg: PackageJson = {
      devDependencies: {
        '@babel/core': '^7.0.0',
        '@babel/preset-env': '^7.0.0',
        '@babel/preset-typescript': '^7.0.0',
      },
    }
    const result = babelDetector('/some/path', pkg)

    expect(result?.detectedFrom.some((s) => s.field?.includes('@babel packages'))).toBe(true)
  })
})
