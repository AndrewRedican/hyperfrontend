import { detectLegacyFrameworks, legacyDetectors } from './detect-all'

const mockProjectPath = '/mock/project'

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('legacyDetectors', () => {
  it('contains all legacy framework detectors', () => {
    expect(legacyDetectors).toHaveLength(4)
    expect(legacyDetectors.map((d) => d.id)).toEqual(['angularjs', 'backbone', 'ember', 'jquery'])
  })

  it('has correct category for each detector', () => {
    for (const detector of legacyDetectors) {
      expect(detector.category).toBe('legacy-frontend')
    }
  })
})

describe('detectLegacyFrameworks', () => {
  it('returns empty array when no frameworks detected', () => {
    const result = detectLegacyFrameworks(mockProjectPath, { name: 'test-project' })
    expect(result).toEqual([])
  })

  it('detects multiple legacy frameworks', () => {
    const result = detectLegacyFrameworks(mockProjectPath, {
      name: 'test-project',
      dependencies: {
        jquery: '^3.7.0',
        angular: '^1.8.0',
      },
    })

    expect(result.length).toBe(2)
    expect(result.map((r) => r.id)).toContain('jquery')
    expect(result.map((r) => r.id)).toContain('angularjs')
  })

  it('sorts results by confidence (descending)', () => {
    const result = detectLegacyFrameworks(mockProjectPath, {
      name: 'test-project',
      dependencies: {
        jquery: '^3.7.0',
        backbone: '^1.4.0',
        angular: '^1.8.0',
      },
    })

    expect(result.length).toBe(3)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]?.confidence).toBeGreaterThanOrEqual(result[i + 1]?.confidence ?? 0)
    }
  })
})
