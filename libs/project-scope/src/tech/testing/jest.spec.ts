import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { jestDetector, JEST_CONFIG_PATTERNS } from './jest'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('jestDetector', () => {
  it('exports JEST_CONFIG_PATTERNS', () => {
    expect(JEST_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['jest.config.js', 'jest.config.ts']))
  })

  it('returns null when jest is not detected', () => {
    const result = jestDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects jest from package.json dependencies', () => {
    const result = jestDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jest: '^29.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('jest')
    expect(result?.name).toBe('Jest')
    expect(result?.type).toBe('unit')
    expect(result?.version).toBe('29.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.jest' }]))
  })

  it('detects jest from devDependencies', () => {
    const result = jestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { jest: '~28.0.0' },
    })

    expect(result?.version).toBe('28.0.0')
  })

  it('increases confidence with @types/jest', () => {
    const withTypes = jestDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jest: '^29.0.0' },
      devDependencies: { '@types/jest': '^29.0.0' },
    })

    const withoutTypes = jestDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jest: '^29.0.0' },
    })

    expect(withTypes?.confidence).toBeGreaterThan(withoutTypes?.confidence ?? 0)
  })

  it('detects jest from test script', () => {
    const result = jestDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jest: '^29.0.0' },
      scripts: { test: 'jest --coverage' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'scripts.test' }]))
  })

  it('detects jest field in package.json', () => {
    const result = jestDetector(mockProjectPath, {
      name: 'test-project',
      dependencies: { jest: '^29.0.0' },
      jest: { testEnvironment: 'node' },
    } as Parameters<typeof jestDetector>[1])

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'jest' }]))
  })

  it('detects jest in test script with complex command', () => {
    const result = jestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { jest: '^29.0.0' },
      scripts: { test: 'npm run lint && jest --coverage --verbose' },
    })

    expect(result?.detectedFrom.some((s) => s.field === 'scripts.test')).toBe(true)
  })

  it('does not add scripts.test when test script does not contain jest', () => {
    const result = jestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { jest: '^29.0.0' },
      scripts: { test: 'vitest' },
    })

    expect(result?.detectedFrom.some((s) => s.field === 'scripts.test')).toBe(false)
  })

  it('detects ts-jest for TypeScript support', () => {
    const result = jestDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { jest: '^29.0.0', 'ts-jest': '^29.0.0' },
    })

    expect(result?.detectedFrom.some((s) => s.field === 'dependencies.ts-jest')).toBe(true)
  })
})
