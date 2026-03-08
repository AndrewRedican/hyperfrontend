import type { PackageJson } from '../../project/package'
import { webpackDetector } from './webpack'

describe('webpackDetector', () => {
  it('returns null when webpack is not present', () => {
    const result = webpackDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects webpack from package.json dependencies', () => {
    const pkg: PackageJson = {
      devDependencies: { webpack: '^5.0.0' },
    }
    const result = webpackDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('webpack')
    expect(result?.name).toBe('Webpack')
    expect(result?.version).toBe('5.0.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(50)
  })

  it('increases confidence with webpack-cli', () => {
    const pkg: PackageJson = {
      devDependencies: {
        webpack: '^5.0.0',
        'webpack-cli': '^4.0.0',
      },
    }
    const result = webpackDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('detects from scripts containing webpack', () => {
    const pkg: PackageJson = {
      devDependencies: { webpack: '^5.0.0' },
      scripts: { build: 'webpack --mode production' },
    }
    const result = webpackDetector('/some/path', pkg)

    expect(result?.detectedFrom.some((s) => s.field?.includes('scripts'))).toBe(true)
  })
})
