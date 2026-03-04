import type { PackageJson } from '../../project/package'
import * as detectorHelpers from '../shared-utils/detector-helpers'
import { babelDetector, BABEL_CONFIG_PATTERNS } from './babel'

jest.mock('../shared-utils/detector-helpers', () => ({
  ...jest.requireActual('../shared-utils/detector-helpers'),
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

    expect(result).not.toBeNull()
    expect(result?.id).toBe('babel')
    expect(result?.name).toBe('Babel')
    expect(result?.version).toBe('7.0.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(50)
  })

  it('detects babel config in package.json', () => {
    const pkg: PackageJson = {
      devDependencies: { '@babel/core': '^7.0.0' },
      babel: { presets: ['@babel/preset-env'] },
    }
    const result = babelDetector('/some/path', pkg)

    expect(result?.detectedFrom.some((s) => s.field === 'babel')).toBe(true)
    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('detects babel from config file', () => {
    jest.mocked(detectorHelpers.locateConfigFile).mockReturnValueOnce('/project/babel.config.js')

    const pkg: PackageJson = {
      devDependencies: { '@babel/core': '^7.0.0' },
    }
    const result = babelDetector('/project', pkg)

    expect(result?.configPath).toBe('/project/babel.config.js')
    expect(result?.detectedFrom.some((s) => s.type === 'config-file')).toBe(true)
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
