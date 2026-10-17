import type { PackageJson } from '../../project/package'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as detectorHelpers from '../shared-utils/detector-helpers'
import { rollupDetector, ROLLUP_CONFIG_PATTERNS } from './rollup'

jest.mock('../shared-utils/detector-helpers', () => ({
  ...jest.requireActual<typeof import('../shared-utils/detector-helpers')>('../shared-utils/detector-helpers'),
  locateConfigFile: jest.fn().mockReturnValue(null),
}))

describe('rollupDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exports ROLLUP_CONFIG_PATTERNS', () => {
    expect(ROLLUP_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['rollup.config.js', 'rollup.config.ts']))
  })

  it('returns null when rollup is not present', () => {
    const result = rollupDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects rollup from package.json', () => {
    const pkg: PackageJson = {
      devDependencies: { rollup: '^3.0.0' },
    }
    const result = rollupDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'rollup', name: 'Rollup' }))
  })

  it('scores a rollup dependency at least 55', () => {
    const pkg: PackageJson = {
      devDependencies: { rollup: '^3.0.0' },
    }
    const result = rollupDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(55)
  })

  it('detects rollup plugins', () => {
    const pkg: PackageJson = {
      devDependencies: {
        rollup: '^3.0.0',
        '@rollup/plugin-node-resolve': '^1.0.0',
      },
    }
    const result = rollupDetector('/some/path', pkg)

    expect(result?.detectedFrom.some((s) => s.field?.includes('rollup plugins'))).toBe(true)
  })

  it('detects rollup from config file', () => {
    jest.mocked(detectorHelpers.locateConfigFile).mockReturnValueOnce('/project/rollup.config.js')

    const pkg: PackageJson = {
      devDependencies: { rollup: '^3.0.0' },
    }
    const result = rollupDetector('/project', pkg)

    expect(result).toEqual(
      expect.objectContaining({
        configPath: '/project/rollup.config.js',
        detectedFrom: expect.arrayContaining([expect.objectContaining({ type: 'config-file' })]),
      })
    )
  })

  it('increases confidence with a rollup config file', () => {
    jest.mocked(detectorHelpers.locateConfigFile).mockReturnValueOnce('/project/rollup.config.js')

    const pkg: PackageJson = {
      devDependencies: { rollup: '^3.0.0' },
    }
    const result = rollupDetector('/project', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('detects rollup from build scripts', () => {
    const pkg: PackageJson = {
      devDependencies: { rollup: '^3.0.0' },
      scripts: {
        build: 'rollup -c',
      },
    }
    const result = rollupDetector('/some/path', pkg)

    expect(result?.detectedFrom.some((s) => s.field?.includes('scripts'))).toBe(true)
  })
})
