import { detectLintingTools, lintingDetectors } from './detect-all'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('lintingDetectors', () => {
  it('contains all linting tool detectors', () => {
    expect(lintingDetectors).toHaveLength(4)
    expect(lintingDetectors.map((d) => d.id)).toEqual(['eslint', 'prettier', 'stylelint', 'biome'])
  })
})

describe('detectLintingTools', () => {
  it('returns empty array when no tools detected', () => {
    const result = detectLintingTools(mockProjectPath, { name: 'test-project' })
    expect(result).toEqual([])
  })

  it('detects multiple linting tools', () => {
    const result = detectLintingTools(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        eslint: '^8.0.0',
        prettier: '^3.0.0',
      },
    })

    expect(result.length).toBe(2)
    expect(result.map((r) => r.id)).toContain('eslint')
    expect(result.map((r) => r.id)).toContain('prettier')
  })

  it('sorts results by confidence (descending)', () => {
    const result = detectLintingTools(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        eslint: '^8.0.0',
        prettier: '^3.0.0',
        '@biomejs/biome': '^1.5.0',
      },
    })

    expect(result.length).toBe(3)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]?.confidence).toBeGreaterThanOrEqual(result[i + 1]?.confidence ?? 0)
    }
  })
})
