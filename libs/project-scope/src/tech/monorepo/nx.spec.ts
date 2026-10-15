import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { nxDetector } from './nx'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('nxDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when nx is not detected', () => {
    const result = nxDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects nx from package.json dependencies', () => {
    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(result).toEqual(expect.objectContaining({ id: 'nx', name: 'NX', version: '17.0.0' }))
  })

  it('scores an nx dependency above zero', () => {
    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('increases confidence with @nx/* packages', () => {
    const with_nx_packages = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        nx: '^17.0.0',
        '@nx/js': '^17.0.0',
        '@nx/node': '^17.0.0',
      },
    })

    const without_nx_packages = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(with_nx_packages?.confidence).toBeGreaterThan(without_nx_packages?.confidence ?? 0)
  })

  it('detects @nrwl/* packages (legacy)', () => {
    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        nx: '^17.0.0',
        '@nrwl/react': '^17.0.0',
      },
    })

    expect(result?.detectedFrom.some((s) => s.field === '@nx/* packages')).toBe(true)
  })

  it('detects nx.json config file', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('nx.json')
    })

    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(result).toEqual(
      expect.objectContaining({
        configPath: 'nx.json',
        detectedFrom: expect.arrayContaining([expect.objectContaining({ path: 'nx.json' })]),
      })
    )
  })

  it('scores an nx.json config file at least 70', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('nx.json')
    })

    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('sets workspaceLayout when apps/libs directories exist', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('apps') || path.includes('libs') || path.includes('nx.json')
    })

    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(result?.workspaceLayout).toEqual({
      appsDir: 'apps',
      libsDir: 'libs',
    })
  })

  it('records the apps and libs directories as a detection source', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('apps') || path.includes('libs') || path.includes('nx.json')
    })

    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'apps/ or libs/' })]))
  })

  it('handles only apps directory', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('apps') || path.includes('nx.json')
    })

    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(result?.workspaceLayout).toEqual({ appsDir: 'apps', libsDir: '' })
  })
})
