import type { MockedFunction } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { cypressDetector, CYPRESS_CONFIG_PATTERNS } from './cypress'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('cypressDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('exports CYPRESS_CONFIG_PATTERNS', () => {
    expect(CYPRESS_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['cypress.config.js', 'cypress.config.ts']))
  })

  it('returns null when cypress is not detected', () => {
    const result = cypressDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects cypress from package.json dependencies', () => {
    const result = cypressDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { cypress: '^13.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('cypress')
    expect(result?.name).toBe('Cypress')
    expect(result?.type).toBe('e2e')
    expect(result?.version).toBe('13.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.cypress' }]))
  })

  it('detects cypress from e2e script', () => {
    const result = cypressDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { cypress: '^13.0.0' },
      scripts: { e2e: 'cypress run' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'scripts.e2e or scripts.test:e2e' }]))
  })

  it('increases confidence with cypress config file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('cypress.config.ts')
    })

    const result = cypressDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { cypress: '^13.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.configPath).toBe('cypress.config.ts')
    expect(result?.detectedFrom.some((s) => s.path === 'cypress.config.ts')).toBe(true)
  })

  it('increases confidence with cypress directory', () => {
    mockExists.mockImplementation((path: string) => {
      return path.endsWith('cypress') || path.includes('/cypress')
    })

    const result = cypressDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { cypress: '^13.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(70)
    expect(result?.detectedFrom.some((s) => s.path === 'cypress/')).toBe(true)
  })

  it('detects from test:e2e script', () => {
    const result = cypressDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { cypress: '^13.0.0' },
      scripts: { 'test:e2e': 'cypress run' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(65)
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('cypress.config.ts') || path.endsWith('cypress') || path.includes('/cypress')
    })

    const result = cypressDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { cypress: '^13.0.0' },
      scripts: { e2e: 'cypress run' },
    })

    expect(result?.confidence).toBe(100)
  })
})
