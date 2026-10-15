import type { MockedFunction } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { yarnWorkspacesDetector } from './yarn-workspaces'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

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

    expect(result).toEqual(expect.objectContaining({ id: 'yarn-workspaces', name: 'Yarn Workspaces' }))
  })

  it('scores a workspaces field above zero', () => {
    const result = yarnWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

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
  })

  it('records yarn.lock as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('yarn.lock')
    })

    const result = yarnWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'yarn.lock' })]))
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
  })

  it('records .yarnrc.yml as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.yarnrc.yml')
    })

    const result = yarnWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: '.yarnrc.yml' })]))
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
  })

  it('records the workspaces field, yarn.lock and .yarnrc.yml as the three detection sources', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('yarn.lock') || path.includes('.yarnrc.yml')
    })

    const result = yarnWorkspacesDetector(mockProjectPath, {
      name: 'test-project',
      workspaces: ['packages/*'],
    })

    expect(result?.detectedFrom).toEqual([
      { type: 'package.json', field: 'workspaces' },
      { type: 'lockfile', path: 'yarn.lock' },
      { type: 'config-file', path: '.yarnrc.yml' },
    ])
  })

  it('returns null without workspaces field even with yarn files', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('yarn.lock')
    })

    const result = yarnWorkspacesDetector(mockProjectPath, { name: 'test-project' })

    expect(result).toBeNull()
  })
})
