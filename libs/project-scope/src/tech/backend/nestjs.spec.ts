import type { PackageJson } from '../../project/package'
import { nestDetector } from './nestjs'

describe('nestDetector', () => {
  it('returns null when NestJS is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(nestDetector('/some/path', pkg)).toBeNull()
  })

  it('detects @nestjs/core dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { '@nestjs/core': '^10.0.0' },
    }
    const result = nestDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('nestjs')
    expect(result?.version).toBe('10.0.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects NestJS with platform-express', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        '@nestjs/core': '^10.0.0',
        '@nestjs/platform-express': '^10.0.0',
      },
    }
    const result = nestDetector('/some/path', pkg)
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('increases confidence with @nestjs/common', () => {
    const pkgWithCommon: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        '@nestjs/core': '^10.0.0',
        '@nestjs/common': '^10.0.0',
      },
    }
    const pkgWithoutCommon: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { '@nestjs/core': '^10.0.0' },
    }

    const withCommon = nestDetector('/some/path', pkgWithCommon)
    const withoutCommon = nestDetector('/some/path', pkgWithoutCommon)

    expect(withCommon?.confidence).toBeGreaterThan(withoutCommon?.confidence ?? 0)
  })

  it('detects multiple @nestjs packages and increases confidence', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        '@nestjs/core': '^10.0.0',
        '@nestjs/common': '^10.0.0',
        '@nestjs/platform-express': '^10.0.0',
        '@nestjs/swagger': '^7.0.0',
      },
    }
    const result = nestDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.confidence).toBeGreaterThan(85)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies (@nestjs packages)' }]))
  })

  it('caps confidence at 100', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        '@nestjs/core': '^10.0.0',
        '@nestjs/common': '^10.0.0',
        '@nestjs/platform-express': '^10.0.0',
        '@nestjs/swagger': '^7.0.0',
        '@nestjs/config': '^3.0.0',
      },
    }
    const result = nestDetector('/some/path', pkg)
    expect(result?.confidence).toBeLessThanOrEqual(100)
  })

  it('returns null for empty package.json', () => {
    const pkg: PackageJson = { name: 'empty' }
    expect(nestDetector('/some/path', pkg)).toBeNull()
  })

  it('handles devDependencies', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { '@nestjs/core': '^10.0.0' },
    }
    const result = nestDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('nestjs')
  })
})
