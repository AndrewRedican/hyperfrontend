import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { turborepoDetector } from './turborepo'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('turborepoDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when turborepo is not detected', () => {
    const result = turborepoDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects turbo from package.json dependencies', () => {
    const result = turborepoDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { turbo: '^1.10.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('turborepo')
    expect(result?.name).toBe('Turborepo')
    expect(result?.version).toBe('1.10.0')
    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('detects turbo from scripts', () => {
    const result = turborepoDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { turbo: '^1.10.0' },
      scripts: { build: 'turbo run build' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'scripts (turbo commands)' }]))
  })

  it('detects turbo from turbo.json config file', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('turbo.json')
    })

    const result = turborepoDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { turbo: '^1.10.0' },
    })

    expect(result?.configPath).toBe('turbo.json')
    expect(result?.detectedFrom.some((s) => s.path === 'turbo.json')).toBe(true)
    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('accumulates confidence from multiple sources', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('turbo.json')
    })

    const result = turborepoDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { turbo: '^1.10.0' },
      scripts: { build: 'turbo run build', test: 'turbo run test' },
    })

    expect(result?.confidence).toBe(100)
  })
})
