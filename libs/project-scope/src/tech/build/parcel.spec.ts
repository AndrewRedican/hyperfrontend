import type { PackageJson } from '../../project/package'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as detectorHelpers from '../shared-utils/detector-helpers'
import { parcelDetector, PARCEL_CONFIG_PATTERNS } from './parcel'

jest.mock('../shared-utils/detector-helpers', () => ({
  ...jest.requireActual('../shared-utils/detector-helpers'),
  locateConfigFile: jest.fn().mockReturnValue(null),
}))

describe('parcelDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exports PARCEL_CONFIG_PATTERNS', () => {
    expect(PARCEL_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['.parcelrc']))
  })

  it('returns null when parcel is not present', () => {
    const result = parcelDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects parcel from package.json', () => {
    const pkg: PackageJson = {
      devDependencies: { parcel: '^2.0.0' },
    }
    const result = parcelDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('parcel')
    expect(result?.name).toBe('Parcel')
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('detects parcel-bundler (legacy)', () => {
    const pkg: PackageJson = {
      devDependencies: { 'parcel-bundler': '^1.0.0' },
    }
    const result = parcelDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.version).toBe('1.0.0')
  })

  it('detects parcel from .parcelrc config file', () => {
    jest.mocked(detectorHelpers.locateConfigFile).mockReturnValueOnce('/project/.parcelrc')

    const pkg: PackageJson = {
      devDependencies: { parcel: '^2.0.0' },
    }
    const result = parcelDetector('/project', pkg)

    expect(result?.configPath).toBe('/project/.parcelrc')
    expect(result?.detectedFrom.some((s) => s.type === 'config-file')).toBe(true)
    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('detects parcel from build scripts', () => {
    const pkg: PackageJson = {
      devDependencies: { parcel: '^2.0.0' },
      scripts: {
        build: 'parcel build src/index.html',
        dev: 'parcel serve src/index.html',
      },
    }
    const result = parcelDetector('/some/path', pkg)

    expect(result?.detectedFrom.some((s) => s.field?.includes('scripts'))).toBe(true)
  })
})
