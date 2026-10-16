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

    expect(result).toEqual(expect.objectContaining({ id: 'parcel', name: 'Parcel' }))
  })

  it('scores a parcel dependency at least 60', () => {
    const pkg: PackageJson = {
      devDependencies: { parcel: '^2.0.0' },
    }
    const result = parcelDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('detects parcel-bundler (legacy)', () => {
    const pkg: PackageJson = {
      devDependencies: { 'parcel-bundler': '^1.0.0' },
    }
    const result = parcelDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'parcel', version: '1.0.0' }))
  })

  it('detects parcel from .parcelrc config file', () => {
    jest.mocked(detectorHelpers.locateConfigFile).mockReturnValueOnce('/project/.parcelrc')

    const pkg: PackageJson = {
      devDependencies: { parcel: '^2.0.0' },
    }
    const result = parcelDetector('/project', pkg)

    expect(result).toEqual(
      expect.objectContaining({
        configPath: '/project/.parcelrc',
        detectedFrom: expect.arrayContaining([expect.objectContaining({ type: 'config-file' })]),
      })
    )
  })

  it('increases confidence with a .parcelrc config file', () => {
    jest.mocked(detectorHelpers.locateConfigFile).mockReturnValueOnce('/project/.parcelrc')

    const pkg: PackageJson = {
      devDependencies: { parcel: '^2.0.0' },
    }
    const result = parcelDetector('/project', pkg)

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
