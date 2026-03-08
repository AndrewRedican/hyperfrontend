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

    expect(result).not.toBeNull()
    expect(result?.id).toBe('backbone')
    expect(result?.name).toBe('Backbone.js')
    expect(result?.category).toBe('legacy-frontend')
    expect(result?.version).toBe('1.4.0')
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
    expect(withUnderscore?.detectedFrom.some((s) => s.field === 'dependencies.underscore')).toBe(true)
  })

  it('increases confidence with lodash (underscore alternative)', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', lodash: '^4.17.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.lodash')).toBe(true)
  })

  it('increases confidence with backbone.marionette', () => {
    const result = backboneDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { backbone: '^1.4.0', 'backbone.marionette': '^4.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.backbone.marionette')).toBe(true)
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
