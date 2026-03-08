import { exists } from '../../core/fs'
import { pnpmWorkspacesDetector } from './pnpm-workspaces'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = exists as jest.MockedFunction<typeof exists>

describe('pnpmWorkspacesDetector', () => {
  beforeEach(() => {
    mockExists.mockReset()
    mockExists.mockReturnValue(false)
  })

  it('returns null when pnpm workspaces is not detected', () => {
    const result = pnpmWorkspacesDetector(mockProjectPath)
    expect(result).toBeNull()
  })

  it('detects pnpm workspaces from pnpm-workspace.yaml', () => {
    mockExists.mockImplementation((path: string) => path.endsWith('pnpm-workspace.yaml'))

    const result = pnpmWorkspacesDetector(mockProjectPath)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('pnpm-workspaces')
    expect(result?.name).toBe('pnpm Workspaces')
    expect(result?.configPath).toBe('pnpm-workspace.yaml')
    expect(result?.confidence).toBe(90)
    expect(result?.detectedFrom).toEqual([{ type: 'config-file', path: 'pnpm-workspace.yaml' }])
  })

  it('detects pnpm workspaces from pnpm-lock.yaml only', () => {
    mockExists.mockImplementation((path: string) => path.endsWith('pnpm-lock.yaml'))

    const result = pnpmWorkspacesDetector(mockProjectPath)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('pnpm-workspaces')
    expect(result?.name).toBe('pnpm Workspaces')
    expect(result?.configPath).toBeUndefined()
    expect(result?.confidence).toBe(10)
    expect(result?.detectedFrom).toEqual([{ type: 'lockfile', path: 'pnpm-lock.yaml' }])
  })

  it('detects pnpm workspaces from both config and lockfile', () => {
    mockExists.mockReturnValue(true)

    const result = pnpmWorkspacesDetector(mockProjectPath)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('pnpm-workspaces')
    expect(result?.configPath).toBe('pnpm-workspace.yaml')
    expect(result?.confidence).toBe(100)
    expect(result?.detectedFrom).toHaveLength(2)
    expect(result?.detectedFrom).toContainEqual({ type: 'config-file', path: 'pnpm-workspace.yaml' })
    expect(result?.detectedFrom).toContainEqual({ type: 'lockfile', path: 'pnpm-lock.yaml' })
  })
})
