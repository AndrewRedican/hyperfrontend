import type { PackageJson } from '../../project/package'
import * as fs from '../../core/fs'
import { angularDetector } from './angular'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

describe('angularDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when angular is not present', () => {
    const result = angularDetector('/non-existent', {})
    expect(result).toBeNull()
  })

  it('detects angular from @angular/core', () => {
    const pkg: PackageJson = {
      dependencies: { '@angular/core': '^17.0.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('angular')
    expect(result?.name).toBe('Angular')
    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects legacy AngularJS', () => {
    const pkg: PackageJson = {
      dependencies: { angular: '^1.8.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result?.id).toBe('angularjs')
    expect(result?.name).toBe('AngularJS (Legacy)')
  })

  it('increases confidence with @angular/cli', () => {
    const pkg: PackageJson = {
      dependencies: { '@angular/core': '^17.0.0' },
      devDependencies: { '@angular/cli': '^17.0.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(85)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.@angular/cli')).toBe(true)
  })

  it('increases confidence with angular.json', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('angular.json')
    })

    const pkg: PackageJson = {
      dependencies: { '@angular/core': '^17.0.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(85)
    expect(result?.detectedFrom.some((s) => s.path === 'angular.json')).toBe(true)
  })

  it('caps confidence at 100', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('angular.json')
    })

    const pkg: PackageJson = {
      dependencies: { '@angular/core': '^17.0.0' },
      devDependencies: { '@angular/cli': '^17.0.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result?.confidence).toBe(100)
  })
})
