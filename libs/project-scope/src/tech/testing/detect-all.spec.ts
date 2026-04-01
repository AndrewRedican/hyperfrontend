import { detectTestingFrameworks, testingDetectors } from './detect-all'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('testingDetectors', () => {
  it('contains all testing framework detectors', () => {
    expect(testingDetectors).toHaveLength(5)
    expect(testingDetectors.map((d) => d.id)).toEqual(['jest', 'vitest', 'mocha', 'cypress', 'playwright'])
  })

  it('has correct testType for each detector', () => {
    const types = testingDetectors.map((d) => ({ id: d.id, testType: d.testType }))
    expect(types).toContainEqual({ id: 'jest', testType: 'unit' })
    expect(types).toContainEqual({ id: 'vitest', testType: 'unit' })
    expect(types).toContainEqual({ id: 'mocha', testType: 'unit' })
    expect(types).toContainEqual({ id: 'cypress', testType: 'e2e' })
    expect(types).toContainEqual({ id: 'playwright', testType: 'e2e' })
  })
})

describe('detectTestingFrameworks', () => {
  it('returns empty array when no frameworks detected', () => {
    const result = detectTestingFrameworks(mockProjectPath, { name: 'test-project' })
    expect(result).toEqual([])
  })

  it('detects multiple testing frameworks', () => {
    const result = detectTestingFrameworks(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        jest: '^29.0.0',
        cypress: '^13.0.0',
      },
    })

    expect(result.length).toBe(2)
    expect(result.map((r) => r.id)).toContain('jest')
    expect(result.map((r) => r.id)).toContain('cypress')
  })

  it('sorts results by confidence (descending)', () => {
    const result = detectTestingFrameworks(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        jest: '^29.0.0',
        vitest: '^1.0.0',
        '@playwright/test': '^1.40.0',
      },
    })

    expect(result.length).toBe(3)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]?.confidence).toBeGreaterThanOrEqual(result[i + 1]?.confidence ?? 0)
    }
  })

  it('detects both unit and e2e frameworks', () => {
    const result = detectTestingFrameworks(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        vitest: '^1.0.0',
        '@playwright/test': '^1.40.0',
      },
    })

    const unitFrameworks = result.filter((r) => r.type === 'unit')
    const e2eFrameworks = result.filter((r) => r.type === 'e2e')

    expect(unitFrameworks.length).toBe(1)
    expect(e2eFrameworks.length).toBe(1)
    expect(unitFrameworks[0]?.id).toBe('vitest')
    expect(e2eFrameworks[0]?.id).toBe('playwright')
  })
})
