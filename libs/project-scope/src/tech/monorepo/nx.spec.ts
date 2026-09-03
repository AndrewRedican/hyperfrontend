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

    expect(result).not.toBeNull()
    expect(result?.id).toBe('nx')
    expect(result?.name).toBe('NX')
    expect(result?.version).toBe('17.0.0')
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

    expect(result?.configPath).toBe('nx.json')
    expect(result?.detectedFrom.some((s) => s.path === 'nx.json')).toBe(true)
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
    expect(result?.detectedFrom.some((s) => s.path === 'apps/ or libs/')).toBe(true)
  })

  it('handles only apps directory', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('apps') || path.includes('nx.json')
    })

    const result = nxDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { nx: '^17.0.0' },
    })

    expect(result?.workspaceLayout?.appsDir).toBe('apps')
    expect(result?.workspaceLayout?.libsDir).toBe('')
  })
})
