import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { jqueryDetector } from './jquery'

const mockProjectPath = '/mock/project'

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('jqueryDetector', () => {
  it('returns null when jquery is not detected', () => {
    const result = jqueryDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects jquery from package.json dependencies', () => {
    const result = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jquery: '^3.7.0' },
    })

    expect(result).toEqual(expect.objectContaining({ id: 'jquery', name: 'jQuery', category: 'legacy-frontend', version: '3.7.0' }))
  })

  it('scores a jquery dependency above zero', () => {
    const result = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jquery: '^3.7.0' },
    })

    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('increases confidence with jquery-ui', () => {
    const withUi = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jquery: '^3.7.0', 'jquery-ui': '^1.13.0' },
    })

    const withoutUi = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jquery: '^3.7.0' },
    })

    expect(withUi?.confidence).toBeGreaterThan(withoutUi?.confidence ?? 0)
  })

  it('records jquery-ui as a detection source', () => {
    const result = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jquery: '^3.7.0', 'jquery-ui': '^1.13.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.jquery-ui' })]))
  })

  it('increases confidence with jquery-validation', () => {
    const withValidation = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jquery: '^3.7.0', 'jquery-validation': '^1.19.0' },
    })

    const withoutValidation = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jquery: '^3.7.0' },
    })

    expect(withValidation?.confidence).toBeGreaterThan(withoutValidation?.confidence ?? 0)
  })

  it('records jquery-validation as a detection source', () => {
    const result = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jquery: '^3.7.0', 'jquery-validation': '^1.19.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.jquery-validation' })]))
  })

  it('caps confidence at 100', () => {
    const result = jqueryDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: {
        jquery: '^3.7.0',
        'jquery-ui': '^1.13.0',
        'jquery-validation': '^1.19.0',
      },
    })

    expect(result?.confidence).toBeLessThanOrEqual(100)
  })
})
