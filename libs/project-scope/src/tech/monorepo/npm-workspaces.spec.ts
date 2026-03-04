import * as fs from '../../core/fs'
import { npmWorkspacesDetector } from './npm-workspaces'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('npmWorkspacesDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock implementation to default (returns false)
    jest.mocked(fs.exists).mockReturnValue(false)
  })

  it('returns null when npm workspaces is not detected', () => {
    const result = npmWorkspacesDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects npm workspaces from package.json', () => {
    const result = npmWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('npm-workspaces')
    expect(result?.name).toBe('npm Workspaces')
    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('increases confidence with package-lock.json', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('package-lock.json')
    })

    const result = npmWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.detectedFrom.some((s) => s.type === 'lockfile')).toBe(true)
  })

  it('returns null when yarn.lock is present', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('yarn.lock')
    })

    const result = npmWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result).toBeNull()
  })

  it('handles workspaces array format variations', () => {
    const result = npmWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*', 'apps/*'],
    })

    expect(result).not.toBeNull()
    expect(result?.detectedFrom.some((s) => s.field === 'workspaces')).toBe(true)
  })
})
