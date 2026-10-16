import type { MockedFunction } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { exists } from '../../core/fs'
import { pnpmWorkspacesDetector } from './pnpm-workspaces'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

const mockExists = exists as MockedFunction<typeof exists>

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

    expect(result).toEqual({
      id: 'pnpm-workspaces',
      name: 'pnpm Workspaces',
      configPath: 'pnpm-workspace.yaml',
      confidence: 90,
      detectedFrom: [{ type: 'config-file', path: 'pnpm-workspace.yaml' }],
    })
  })

  it('detects pnpm workspaces from pnpm-lock.yaml only', () => {
    mockExists.mockImplementation((path: string) => path.endsWith('pnpm-lock.yaml'))

    const result = pnpmWorkspacesDetector(mockProjectPath)

    expect(result).toEqual({
      id: 'pnpm-workspaces',
      name: 'pnpm Workspaces',
      confidence: 10,
      detectedFrom: [{ type: 'lockfile', path: 'pnpm-lock.yaml' }],
    })
  })

  it('detects pnpm workspaces from both config and lockfile', () => {
    mockExists.mockReturnValue(true)

    const result = pnpmWorkspacesDetector(mockProjectPath)

    expect(result).toEqual({
      id: 'pnpm-workspaces',
      name: 'pnpm Workspaces',
      configPath: 'pnpm-workspace.yaml',
      confidence: 100,
      detectedFrom: [
        { type: 'config-file', path: 'pnpm-workspace.yaml' },
        { type: 'lockfile', path: 'pnpm-lock.yaml' },
      ],
    })
  })
})
