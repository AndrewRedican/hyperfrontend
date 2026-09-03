import type { MockedFunction } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { stylelintDetector, STYLELINT_CONFIG_PATTERNS } from './stylelint'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('stylelintDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('exports STYLELINT_CONFIG_PATTERNS', () => {
    expect(STYLELINT_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['.stylelintrc', 'stylelint.config.js']))
  })

  it('returns null when stylelint is not detected', () => {
    const result = stylelintDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects stylelint from package.json dependencies', () => {
    const result = stylelintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { stylelint: '^15.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('stylelint')
    expect(result?.name).toBe('Stylelint')
    expect(result?.version).toBe('15.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.stylelint' }]))
  })

  it('increases confidence with stylelint plugins', () => {
    const withPlugins = stylelintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        stylelint: '^15.0.0',
        'stylelint-config-standard': '^34.0.0',
      },
    })

    const withoutPlugins = stylelintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { stylelint: '^15.0.0' },
    })

    expect(withPlugins?.confidence).toBeGreaterThan(withoutPlugins?.confidence ?? 0)
    expect(withPlugins?.detectedFrom.some((s) => s.field === 'dependencies (stylelint plugins)')).toBe(true)
  })

  it('detects stylelint config file (.stylelintrc)', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.stylelintrc') && !path.includes('.stylelintrc.')
    })

    const result = stylelintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { stylelint: '^15.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
    expect(result?.configPath).toBe('.stylelintrc')
  })

  it('detects stylelint.config.js file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('stylelint.config.js')
    })

    const result = stylelintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { stylelint: '^15.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
    expect(result?.configPath).toBe('stylelint.config.js')
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.stylelintrc') && !path.includes('.stylelintrc.')
    })

    const result = stylelintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        stylelint: '^15.0.0',
        'stylelint-config-standard': '^34.0.0',
        'stylelint-scss': '^5.0.0',
      },
    })

    expect(result?.confidence).toBe(100)
  })
})
