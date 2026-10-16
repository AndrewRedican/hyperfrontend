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

    expect(result).toEqual(expect.objectContaining({ id: 'ember', name: 'Ember.js', category: 'legacy-frontend', version: '5.0.0' }))
  })

  it('scores an ember-source dependency above zero', () => {
    const result = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0' },
    })

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
  })

  it('records ember-cli as a detection source', () => {
    const result = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0', 'ember-cli': '^5.0.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'devDependencies.ember-cli' })]))
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
  })

  it('records ember-data as a detection source', () => {
    const result = emberDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { 'ember-source': '^5.0.0' },
      dependencies: { 'ember-data': '^5.0.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.ember-data' })]))
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
