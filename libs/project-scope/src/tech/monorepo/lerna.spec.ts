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

    expect(result).toEqual(expect.objectContaining({ id: 'lerna', name: 'Lerna', version: '7.0.0' }))
  })

  it('scores a lerna dependency above zero', () => {
    const result = lernaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { lerna: '^7.0.0' },
    })

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

    expect(result).toEqual(
      expect.objectContaining({
        configPath: 'lerna.json',
        detectedFrom: expect.arrayContaining([expect.objectContaining({ path: 'lerna.json' })]),
      })
    )
  })

  it('scores a lerna.json config file at least 80', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('lerna.json')
    })

    const result = lernaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { lerna: '^7.0.0' },
    })

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

    expect(result?.confidence).toBeGreaterThan(80)
  })

  it('records the packages directory as a detection source', () => {
    jest.mocked(fs.exists).mockImplementation((path: string) => {
      return path.includes('lerna.json') || path.includes('packages')
    })

    const result = lernaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { lerna: '^7.0.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'packages/' })]))
  })
})
