import * as fs from '../../core/fs'
import { yarnWorkspacesDetector } from './yarn-workspaces'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

describe('yarnWorkspacesDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when yarn workspaces is not detected', () => {
    const result = yarnWorkspacesDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects yarn workspaces from package.json', () => {
    const result = yarnWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('yarn-workspaces')
    expect(result?.name).toBe('Yarn Workspaces')
    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('increases confidence with yarn.lock file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('yarn.lock')
    })

    const result = yarnWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.detectedFrom.some((s) => s.path === 'yarn.lock')).toBe(true)
  })

  it('increases confidence with .yarnrc.yml file (Yarn 2+)', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.yarnrc.yml')
    })

    const result = yarnWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom.some((s) => s.path === '.yarnrc.yml')).toBe(true)
  })

  it('combines all detection sources for maximum confidence', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('yarn.lock') || path.includes('.yarnrc.yml')
    })

    const result = yarnWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result?.confidence).toBe(100)
    expect(result?.detectedFrom.length).toBe(3)
  })

  it('returns null without workspaces field even with yarn files', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('yarn.lock')
    })

    const result = yarnWorkspacesDetector(mockProjectPath, { name: 'test-project' })

    expect(result).toBeNull()
  })
})
