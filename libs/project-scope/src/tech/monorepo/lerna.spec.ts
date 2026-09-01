import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { lernaDetector } from './lerna'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('lernaDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when lerna is not detected', () => {
    const result = lernaDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects lerna from package.json dependencies', () => {
    const result = lernaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { lerna: '^7.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('lerna')
    expect(result?.name).toBe('Lerna')
    expect(result?.version).toBe('7.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('detects lerna from lerna.json config file', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('lerna.json')
    })

    const result = lernaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { lerna: '^7.0.0' },
    })

    expect(result?.configPath).toBe('lerna.json')
    expect(result?.detectedFrom.some((s) => s.path === 'lerna.json')).toBe(true)
    expect(result?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('increases confidence with packages directory', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('lerna.json') || path.includes('packages')
    })

    const result = lernaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { lerna: '^7.0.0' },
    })

    expect(result?.detectedFrom.some((s) => s.path === 'packages/')).toBe(true)
    expect(result?.confidence).toBeGreaterThan(80)
  })
})
