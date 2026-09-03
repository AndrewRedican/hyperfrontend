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

    expect(result).not.toBeNull()
    expect(result?.id).toBe('angularjs')
    expect(result?.name).toBe('AngularJS')
    expect(result?.category).toBe('legacy-frontend')
    expect(result?.version).toBe('1.8.0')
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
    expect(withRoute?.detectedFrom.some((s) => s.field === 'dependencies.angular-route')).toBe(true)
  })

  it('increases confidence with angular-resource', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0', 'angular-resource': '^1.8.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.angular-resource')).toBe(true)
  })

  it('increases confidence with angular-animate', () => {
    const result = angularJSDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { angular: '^1.8.0', 'angular-animate': '^1.8.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.angular-animate')).toBe(true)
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
