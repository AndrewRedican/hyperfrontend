import { detectMonorepoTools, monorepoDetectors } from './detect-all'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('monorepoDetectors', () => {
  it('contains all monorepo tool detectors', () => {
    expect(monorepoDetectors).toHaveLength(7)
    expect(monorepoDetectors.map((d) => d.id)).toEqual([
      'nx',
      'turborepo',
      'lerna',
      'rush',
      'pnpm-workspaces',
      'npm-workspaces',
      'yarn-workspaces',
    ])
  })
})

describe('detectMonorepoTools', () => {
  it('returns empty array when no tools detected', () => {
    const result = detectMonorepoTools(mockProjectPath, { name: 'test-project' })
    expect(result).toEqual([])
  })

  it('detects multiple monorepo tools', () => {
    const result = detectMonorepoTools(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        nx: '^17.0.0',
        lerna: '^7.0.0',
      },
    })

    expect(result.length).toBe(2)
    expect(result.map((r) => r.id)).toContain('nx')
    expect(result.map((r) => r.id)).toContain('lerna')
  })

  it('sorts results by confidence (descending)', () => {
    const result = detectMonorepoTools(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        nx: '^17.0.0',
        turbo: '^1.10.0',
      },
      workspaces: ['packages/*'],
    })

    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]?.confidence).toBeGreaterThanOrEqual(result[i + 1]?.confidence ?? 0)
    }
  })
})
