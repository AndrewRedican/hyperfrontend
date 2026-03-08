import { eslintDetector, ESLINT_CONFIG_PATTERNS } from './eslint'

const mockProjectPath = '/mock/project'

jest.mock('../../core/fs', () => ({
  exists: jest.fn().mockReturnValue(false),
}))

jest.mock('../../project/package', () => ({
  readPackageJsonIfExists: jest.fn().mockReturnValue(null),
}))

describe('eslintDetector', () => {
  it('exports ESLINT_CONFIG_PATTERNS', () => {
    expect(ESLINT_CONFIG_PATTERNS).toEqual(expect.arrayContaining(['eslint.config.js', '.eslintrc.js']))
  })

  it('returns null when eslint is not detected', () => {
    const result = eslintDetector(mockProjectPath, { name: 'test-project' })
    expect(result).toBeNull()
  })

  it('detects eslint from package.json dependencies', () => {
    const result = eslintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { eslint: '^8.0.0' },
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('eslint')
    expect(result?.name).toBe('ESLint')
    expect(result?.version).toBe('8.0.0')
    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'dependencies.eslint' }]))
  })

  it('increases confidence with eslint plugins', () => {
    const withPlugins = eslintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: {
        eslint: '^8.0.0',
        'eslint-plugin-react': '^7.0.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
      },
    })

    const withoutPlugins = eslintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { eslint: '^8.0.0' },
    })

    expect(withPlugins?.confidence).toBeGreaterThan(withoutPlugins?.confidence ?? 0)
  })

  it('detects eslint from lint script', () => {
    const result = eslintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { eslint: '^8.0.0' },
      scripts: { lint: 'eslint .' },
    })

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'scripts.lint' }]))
  })

  it('detects eslintConfig in package.json', () => {
    const result = eslintDetector(mockProjectPath, {
      name: 'test-project',
      devDependencies: { eslint: '^8.0.0' },
      eslintConfig: { extends: ['eslint:recommended'] },
    } as Parameters<typeof eslintDetector>[1])

    expect(result?.detectedFrom).toEqual(expect.arrayContaining([{ type: 'package.json', field: 'eslintConfig' }]))
  })
})
