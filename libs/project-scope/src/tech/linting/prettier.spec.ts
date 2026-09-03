import type { MockedFunction } from '@hyperfrontend/testing'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fs from '../../core/fs'
import { prettierDetector, PRETTIER_CONFIG_PATTERNS } from './prettier'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

const mockExists = fs.exists as MockedFunction<typeof fs.exists>

describe('prettierDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExists.mockReturnValue(false)
  })

  it('exports PRETTIER_CONFIG_PATTERNS', () => {
    expect(PRETTIER_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['.prettierrc', 'prettier.config.js']))
  })

  it('returns null when prettier is not detected', () => {
    const result = prettierDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects prettier from package.json dependencies', () => {
    const result = prettierDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { prettier: '^3.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('prettier')
    expect(result?.name).toBe('Prettier')
    expect(result?.version).toBe('3.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.prettier' }]))
  })

  it('detects prettier field in package.json', () => {
    const result = prettierDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { prettier: '^3.0.0' },
      prettier: { singleQuote: true },
    } as Parameters<typeof prettierDetector>[1])

    expect(result?.confidence).toBeGreaterThanOrEqual(80)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'prettier' }]))
  })

  it('detects prettier from format script', () => {
    const result = prettierDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { prettier: '^3.0.0' },
      scripts: { format: 'prettier --write .' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'scripts.format' }]))
  })

  it('detects prettier config file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.prettierrc')
    })

    const result = prettierDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { prettier: '^3.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(90)
    expect(result?.configPath).toBe('.prettierrc')
  })

  it('detects .prettierignore file', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.prettierignore')
    })

    const result = prettierDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { prettier: '^3.0.0' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(60)
    expect(result?.detectedFrom.some((s) => s.path === '.prettierignore')).toBe(true)
  })

  it('detects prettier plugins', () => {
    const result = prettierDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        prettier: '^3.0.0',
        'prettier-plugin-tailwindcss': '^0.5.0',
      },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(55)
    expect(result?.detectedFrom.some((s) => s.field === 'dependencies (prettier plugins)')).toBe(true)
  })

  it('detects from prettier named script', () => {
    const result = prettierDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { prettier: '^3.0.0' },
      scripts: { prettier: 'prettier --check .' },
    })

    expect(result?.confidence).toBeGreaterThanOrEqual(55)
  })

  it('has maximum confidence with all indicators', () => {
    mockExists.mockImplementation((path: string) => {
      return path.includes('.prettierrc') || path.includes('.prettierignore')
    })

    const result = prettierDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        prettier: '^3.0.0',
        'prettier-plugin-tailwindcss': '^0.5.0',
      },
      prettier: { singleQuote: true },
      scripts: { format: 'prettier --write .' },
    } as Parameters<typeof prettierDetector>[1])

    expect(result?.confidence).toBe(100)
  })
})
