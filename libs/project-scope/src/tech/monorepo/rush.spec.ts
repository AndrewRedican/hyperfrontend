import type { MockedFunction } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { rushDetector } from './rush'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('rushDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('returns null when rush is not detected', () => {
    const result = rushDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects @microsoft/rush from package.json dependencies', () => {
    const result = rushDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@microsoft/rush': '^5.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('rush')
    expect(result?.name).toBe('Rush')
    expect(result?.version).toBe('5.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('detects rush.json config file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('rush.json')
    })

    const result = rushDetector(mockProjectPath, { name: 'test-project' })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('rush')
    expect(result?.configPath).toBe('rush.json')
    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.detectedFrom.some((s) => s.path === 'rush.json')).toBe(true)
  })

  it('increases confidence with common/config/rush directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('rush.json') || path.includes('common/config/rush')
    })

    const result = rushDetector(mockProjectPath, { name: 'test-project' })

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
    expect(result?.detectedFrom.some((s) => s.path === 'common/config/rush/')).toBe(true)
  })

  it('combines rush.json and @microsoft/rush package detection', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('rush.json')
    })

    const result = rushDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@microsoft/rush': '^5.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.confidence).toBe(100)
    expect(result?.version).toBe('5.0.0')
  })
})
