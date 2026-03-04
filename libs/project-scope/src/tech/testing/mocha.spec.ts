import * as fs from '../../core/fs'
import { mochaDetector, MOCHA_CONFIG_PATTERNS } from './mocha'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as jest.MockedFunction<typeof fs.exists>

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

    expect(result).not.toBeNull()
    expect(result?.id).toBe('mocha')
    expect(result?.name).toBe('Mocha')
    expect(result?.type).toBe('unit')
    expect(result?.version).toBe('10.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.mocha' }]))
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
    expect(withChai?.detectedFrom.some((s) => s.field === 'dependencies.chai')).toBe(true)
  })

  it('increases confidence with @types/mocha', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0', '@types/mocha': '^10.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.@types/mocha')).toBe(true)
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
    expect(result?.configPath).toBe('.mocharc.json')
  })

  it('increases confidence with mocha test script', () => {
    const result = mochaDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { mocha: '^10.0.0' },
      scripts: { test: 'mocha' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.field === 'scripts.test')).toBe(true)
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
