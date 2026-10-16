import type { MockedFunction } from '@hyperfrontend/testing'
import type { PackageJson } from '../../project/package'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { angularDetector } from './angular'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

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

    expect(result).toEqual(expect.objectContaining({ id: 'angular', name: 'Angular' }))
  })

  it('scores @angular/core at least 70', () => {
    const pkg: PackageJson = {
      dependencies: { '@angular/core': '^17.0.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects legacy AngularJS', () => {
    const pkg: PackageJson = {
      dependencies: { angular: '^1.8.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result).toEqual(expect.objectContaining({ id: 'angularjs', name: 'AngularJS (Legacy)' }))
  })

  it('increases confidence with @angular/cli', () => {
    const pkg: PackageJson = {
      dependencies: { '@angular/core': '^17.0.0' },
      devDependencies: { '@angular/cli': '^17.0.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(85)
  })

  it('records @angular/cli as a detection source', () => {
    const pkg: PackageJson = {
      dependencies: { '@angular/core': '^17.0.0' },
      devDependencies: { '@angular/cli': '^17.0.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.@angular/cli' })]))
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
  })

  it('records angular.json as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('angular.json')
    })

    const pkg: PackageJson = {
      dependencies: { '@angular/core': '^17.0.0' },
    }
    const result = angularDetector('/some/path', pkg)

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'angular.json' })]))
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
