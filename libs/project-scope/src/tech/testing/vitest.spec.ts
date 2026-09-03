import type { MockedFunction } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { vitestDetector, VITEST_CONFIG_PATTERNS } from './vitest'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('vitestDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('exports VITEST_CONFIG_PATTERNS', () => {
    expect(VITEST_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['vitest.config.js', 'vitest.config.ts']))
  })

  it('returns null when vitest is not detected', () => {
    const result = vitestDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects vitest from package.json dependencies', () => {
    const result = vitestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { vitest: '^1.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('vitest')
    expect(result?.name).toBe('Vitest')
    expect(result?.type).toBe('unit')
    expect(result?.version).toBe('1.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.vitest' }]))
  })

  it('detects vitest from test script', () => {
    const result = vitestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { vitest: '^1.0.0' },
      scripts: { test: 'vitest run' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'scripts.test' }]))
  })

  it('increases confidence with vitest config file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('vitest.config.ts')
    })

    const result = vitestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { vitest: '^1.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(95)
    expect(result?.configPath).toBe('vitest.config.ts')
  })

  it('detects vitest configured in vite.config when no vitest config', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('vite.config.ts')
    })

    const result = vitestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { vitest: '^1.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
    expect(result?.detectedFrom.some((s) => s.path === 'vite.config.*')).toBe(true)
  })

  it('detects vitest configured in vite.config.js', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('vite.config.js')
    })

    const result = vitestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { vitest: '^1.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('detects vitest configured in vite.config.mjs', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('vite.config.mjs')
    })

    const result = vitestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { vitest: '^1.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('vitest.config.ts')
    })

    const result = vitestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { vitest: '^1.0.0' },
      scripts: { test: 'vitest run' },
    })

    expect(result?.confidence).toBe(100)
  })
})
