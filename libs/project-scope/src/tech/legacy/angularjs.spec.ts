import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { angularJSDetector } from './angularjs'

const mockProjectPath = '/mock/project'

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('angularJSDetector', () => {
  it('returns null when angularjs is not detected', () => {
    const result = angularJSDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects angular from package.json dependencies', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0' },
    })

    expect(result).toEqual(expect.objectContaining({ id: 'angularjs', name: 'AngularJS', category: 'legacy-frontend', version: '1.8.0' }))
  })

  it('scores an angular dependency above zero', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0' },
    })

    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('increases confidence with angular-route', () => {
    const withRoute = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0', 'angular-route': '^1.8.0' },
    })

    const withoutRoute = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0' },
    })

    expect(withRoute?.confidence).toBeGreaterThan(withoutRoute?.confidence ?? 0)
  })

  it('records angular-route as a detection source', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0', 'angular-route': '^1.8.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.angular-route' })]))
  })

  it('increases confidence with angular-resource', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0', 'angular-resource': '^1.8.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('records angular-resource as a detection source', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0', 'angular-resource': '^1.8.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.angular-resource' })]))
  })

  it('increases confidence with angular-animate', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0', 'angular-animate': '^1.8.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('records angular-animate as a detection source', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0', 'angular-animate': '^1.8.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.angular-animate' })]))
  })

  it('has maximum confidence with all angular packages', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: {
        angular: '^1.8.0',
        'angular-route': '^1.8.0',
        'angular-resource': '^1.8.0',
        'angular-animate': '^1.8.0',
      },
    })

    expect(result?.confidence).toBe(100)
  })
})
