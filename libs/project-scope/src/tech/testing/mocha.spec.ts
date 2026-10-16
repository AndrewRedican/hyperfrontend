import type { MockedFunction } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { mochaDetector, MOCHA_CONFIG_PATTERNS } from './mocha'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('mochaDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('exports MOCHA_CONFIG_PATTERNS', () => {
    expect(MOCHA_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['.mocharc.js', '.mocharc.json']))
  })

  it('returns null when mocha is not detected', () => {
    const result = mochaDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects mocha from package.json dependencies', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0' },
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: 'mocha',
        name: 'Mocha',
        type: 'unit',
        version: '10.0.0',
        detectedFrom: expect.arrayContaining([{ type: 'package.json', field: 'dependencies.mocha' }]),
      })
    )
  })

  it('scores a mocha dependency above zero', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0' },
    })

    expect(result?.confidence).toBeGreaterThan(0)
  })

  it('increases confidence with chai', () => {
    const withChai = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0', chai: '^4.0.0' },
    })

    const withoutChai = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0' },
    })

    expect(withChai?.confidence).toBeGreaterThan(withoutChai?.confidence ?? 0)
  })

  it('records chai as a detection source', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0', chai: '^4.0.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.chai' })]))
  })

  it('increases confidence with @types/mocha', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0', '@types/mocha': '^10.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('records @types/mocha as a detection source', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0', '@types/mocha': '^10.0.0' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'dependencies.@types/mocha' })]))
  })

  it('increases confidence with config file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.mocharc.json')
    })

    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
  })

  it('records .mocharc.json as the config path', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.mocharc.json')
    })

    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0' },
    })

    expect(result?.configPath).toBe('.mocharc.json')
  })

  it('increases confidence with mocha test script', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0' },
      scripts: { test: 'mocha' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('records the mocha test script as a detection source', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0' },
      scripts: { test: 'mocha' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'scripts.test' })]))
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.mocharc.json')
    })

    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        mocha: '^10.0.0',
        chai: '^4.0.0',
        '@types/mocha': '^10.0.0',
      },
      scripts: { test: 'mocha' },
    })

    expect(result?.confidence).toBe(100)
  })
})
