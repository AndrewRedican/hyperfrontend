import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { backboneDetector } from './backbone'

const mockProjectPath = '/mock/project'

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('backboneDetector', () => {
  it('returns null when backbone is not detected', () => {
    const result = backboneDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects backbone from package.json dependencies', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0' },
    })

    expect(result).toEqual(expect.objectContaining({ id: 'backbone', name: 'Backbone.js', category: 'legacy-frontend', version: '1.4.0' }))
  })

  it('scores a backbone dependency above zero', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0' },
    })

    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('increases confidence with underscore', () => {
    const withUnderscore = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', underscore: '^1.13.0' },
    })

    const withoutUnderscore = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0' },
    })

    expect(withUnderscore?.confidence).toBeGreaterThan(withoutUnderscore?.confidence ?? 0)
  })

  it('records underscore as a detection source', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', underscore: '^1.13.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.underscore' })]))
  })

  it('increases confidence with lodash (underscore alternative)', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', lodash: '^4.17.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('records lodash as a detection source', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', lodash: '^4.17.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.lodash' })]))
  })

  it('increases confidence with backbone.marionette', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', 'backbone.marionette': '^4.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('records backbone.marionette as a detection source', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', 'backbone.marionette': '^4.0.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.backbone.marionette' })]))
  })

  it('increases confidence with marionette package name', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', marionette: '^4.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('has maximum confidence with all backbone packages', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: {
        backbone: '^1.4.0',
        underscore: '^1.13.0',
        lodash: '^4.17.0',
        'backbone.marionette': '^4.0.0',
      },
    })

    expect(result?.confidence).toBe(100)
  })
})
