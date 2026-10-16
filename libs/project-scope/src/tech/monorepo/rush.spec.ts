import type { MockedFunction } from '@hyperfrontend/testing'
import { join } from 'node:path'
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

    expect(result).toEqual(expect.objectContaining({ id: 'rush', name: 'Rush', version: '5.0.0' }))
  })

  it('scores a @microsoft/rush dependency above zero', () => {
    const result = rushDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@microsoft/rush': '^5.0.0' },
    })

    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('detects rush.json config file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('rush.json')
    })

    const result = rushDetector(mockProjectPath, { name: 'test-project' })

    expect(result).toEqual(
      expect.objectContaining({
        id: 'rush',
        configPath: 'rush.json',
        detectedFrom: expect.arrayContaining([expect.objectContaining({ path: 'rush.json' })]),
      })
    )
  })

  it('scores a rush.json config file at least 90', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('rush.json')
    })

    const result = rushDetector(mockProjectPath, { name: 'test-project' })

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('increases confidence with common/config/rush directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('rush.json') || path.includes(join('common', 'config', 'rush'))
    })

    const result = rushDetector(mockProjectPath, { name: 'test-project' })

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('records the common/config/rush directory as a detection source', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('rush.json') || path.includes(join('common', 'config', 'rush'))
    })

    const result = rushDetector(mockProjectPath, { name: 'test-project' })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'common/config/rush/' })]))
  })

  it('combines rush.json and @microsoft/rush package detection', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('rush.json')
    })

    const result = rushDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { '@microsoft/rush': '^5.0.0' },
    })

    expect(result).toEqual(expect.objectContaining({ confidence: 100, version: '5.0.0' }))
  })
})
