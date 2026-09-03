import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { emberDetector } from './ember'

const mockProjectPath = '/mock/project'

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('emberDetector', () => {
  it('returns null when ember is not detected', () => {
    const result = emberDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects ember-source from package.json dependencies', () => {
    const result = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('ember')
    expect(result?.name).toBe('Ember.js')
    expect(result?.category).toBe('legacy-frontend')
    expect(result?.version).toBe('5.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('increases confidence with ember-cli', () => {
    const withCli = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0', 'ember-cli': '^5.0.0' },
    })

    const withoutCli = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0' },
    })

    expect(withCli?.confidence).toBeGreaterThan(withoutCli?.confidence ?? 0)
    expect(withCli?.detectedFrom.some((s) => s.field === 'devDependencies.ember-cli')).toBe(true)
  })

  it('increases confidence with ember-data', () => {
    const withData = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0' },
      dependencies: { 'ember-data': '^5.0.0' },
    })

    const withoutData = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0' },
    })

    expect(withData?.confidence).toBeGreaterThan(withoutData?.confidence ?? 0)
    expect(withData?.detectedFrom.some((s) => s.field === 'dependencies.ember-data')).toBe(true)
  })

  it('caps confidence at 100', () => {
    const result = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0', 'ember-cli': '^5.0.0' },
      dependencies: { 'ember-data': '^5.0.0' },
    })

    expect(result?.confidence).toBe(100)
  })
})
