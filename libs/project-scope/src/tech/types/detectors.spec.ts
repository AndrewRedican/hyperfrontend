import type { PackageJson } from '../../project/package'
import { resolve } from 'node:path'
import { detectTypeSystems, flowDetector, jsdocDetector, typescriptDetector, typeSystemDetectors } from './detectors'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const TYPESCRIPT_STRICT = resolve(FIXTURES_DIR, 'typescript-strict')
const FLOW_PROJECT = resolve(FIXTURES_DIR, 'flow-project')
const JSDOC_PROJECT = resolve(FIXTURES_DIR, 'jsdoc-project')
const JSCONFIG_PROJECT = resolve(FIXTURES_DIR, 'jsconfig-project')

describe('typescriptDetector', () => {
  it('returns null when typescript is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(typescriptDetector('/some/path', pkg)).toBeNull()
  })

  it('detects typescript devDependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    }
    const result = typescriptDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('typescript')
    expect(result?.version).toBe('5.0.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(50)
  })

  it('detects typescript in dependencies', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { typescript: '^5.0.0' },
    }
    const result = typescriptDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('typescript')
  })
})

describe('flowDetector', () => {
  it('returns null when flow is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(flowDetector('/some/path', pkg)).toBeNull()
  })

  it('detects flow-bin dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { 'flow-bin': '^0.220.0' },
    }
    const result = flowDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('flow')
    expect(result?.version).toBe('0.220.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })
})

describe('jsdocDetector', () => {
  it('returns null when jsdoc is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(jsdocDetector('/some/path', pkg)).toBeNull()
  })

  it('detects jsdoc dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { jsdoc: '^4.0.0' },
    }
    const result = jsdocDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('jsdoc')
    expect(result?.confidence).toBeGreaterThanOrEqual(30)
  })
})

describe('detectTypeSystems', () => {
  it('returns empty array when no type systems detected', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(detectTypeSystems('/some/path', pkg)).toEqual([])
  })

  it('detects single type system', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    }
    const results = detectTypeSystems('/some/path', pkg)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('typescript')
  })

  it('detects multiple type systems', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: {
        typescript: '^5.0.0',
        jsdoc: '^4.0.0',
      },
    }
    const results = detectTypeSystems('/some/path', pkg)
    expect(results.length).toBeGreaterThanOrEqual(2)
    const ids = results.map((r) => r.id)
    expect(ids).toContain('typescript')
    expect(ids).toContain('jsdoc')
  })

  it('sorts results by confidence', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: {
        typescript: '^5.0.0',
        'flow-bin': '^0.220.0',
        jsdoc: '^4.0.0',
      },
    }
    const results = detectTypeSystems('/some/path', pkg)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence)
    }
  })
})

describe('typeSystemDetectors', () => {
  it('exports array of detector objects', () => {
    expect(Array.isArray(typeSystemDetectors)).toBe(true)
    expect(typeSystemDetectors.length).toBe(3)
    typeSystemDetectors.forEach((detector) => {
      expect(typeof detector).toBe('object')
      expect(typeof detector.detect).toBe('function')
      expect(typeof detector.id).toBe('string')
      expect(typeof detector.name).toBe('string')
    })
  })
})

describe('typescriptDetector with fixtures', () => {
  it('detects tsconfig.json presence', () => {
    const result = typescriptDetector(TYPESCRIPT_STRICT)

    expect(result).not.toBeNull()
    expect(result?.configPath).toBe('tsconfig.json')
    expect(result?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('detects strict mode from tsconfig', () => {
    const result = typescriptDetector(TYPESCRIPT_STRICT)

    expect(result?.strictMode).toBe(true)
  })

  it('detects @types packages', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        '@types/react': '^18.0.0',
      },
    }
    const result = typescriptDetector('/some/path', pkg)

    expect(result?.confidence).toBeGreaterThanOrEqual(60)
    expect(result?.detectedFrom.some((s) => s.field?.includes('@types'))).toBe(true)
  })

  it('detects tsconfig variants', () => {
    const result = typescriptDetector(TYPESCRIPT_STRICT)

    // tsconfig.build.json should be detected
    expect(result?.detectedFrom.some((s) => s.path?.includes('tsconfig.build.json'))).toBe(true)
  })
})

describe('flowDetector with fixtures', () => {
  it('detects .flowconfig presence', () => {
    const result = flowDetector(FLOW_PROJECT)

    expect(result).not.toBeNull()
    expect(result?.configPath).toBe('.flowconfig')
  })

  it('detects flow-typed directory', () => {
    const result = flowDetector(FLOW_PROJECT)

    expect(result?.detectedFrom.some((s) => s.path?.includes('flow-typed'))).toBe(true)
  })

  it('detects @babel/preset-flow', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: {
        'flow-bin': '^0.220.0',
        '@babel/preset-flow': '^7.0.0',
      },
    }
    const result = flowDetector('/some/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.detectedFrom.some((s) => s.field?.includes('@babel/preset-flow'))).toBe(true)
  })
})

describe('jsdocDetector with fixtures', () => {
  it('detects checkJs/allowJs in tsconfig', () => {
    const result = jsdocDetector(JSDOC_PROJECT)

    expect(result).not.toBeNull()
    expect(result?.detectedFrom.some((s) => s.path?.includes('checkJs') || s.path?.includes('allowJs'))).toBe(true)
  })

  it('detects jsconfig.json presence', () => {
    const result = jsdocDetector(JSCONFIG_PROJECT)

    expect(result).not.toBeNull()
    expect(result?.detectedFrom.some((s) => s.path?.includes('jsconfig.json'))).toBe(true)
    expect(result?.confidence).toBeGreaterThanOrEqual(40)
  })

  it('detects JSDoc annotations in source files', () => {
    const result = jsdocDetector(JSDOC_PROJECT)

    // Should detect JSDoc annotations in src/index.js
    expect(result?.detectedFrom.some((s) => s.path?.includes('JSDoc annotations'))).toBe(true)
  })

  it('detects jsdoc package with jsconfig', () => {
    const result = jsdocDetector(JSCONFIG_PROJECT)

    expect(result).not.toBeNull()
  })
})

describe('detectTypeSystems with fixtures', () => {
  it('detects TypeScript with strict mode', () => {
    const results = detectTypeSystems(TYPESCRIPT_STRICT)

    const tsResult = results.find((r) => r.id === 'typescript')
    expect(tsResult).toBeDefined()
    expect(tsResult?.strictMode).toBe(true)
  })

  it('detects Flow with all indicators', () => {
    const results = detectTypeSystems(FLOW_PROJECT)

    const flowResult = results.find((r) => r.id === 'flow')
    expect(flowResult).toBeDefined()
    expect(flowResult?.confidence).toBeGreaterThanOrEqual(100)
  })

  it('detects JSDoc with jsconfig', () => {
    const results = detectTypeSystems(JSCONFIG_PROJECT)

    const jsdocResult = results.find((r) => r.id === 'jsdoc')
    expect(jsdocResult).toBeDefined()
  })
})

const INVALID_TSCONFIG = resolve(FIXTURES_DIR, 'invalid-tsconfig')

describe('typescriptDetector edge cases', () => {
  it('handles invalid tsconfig.json gracefully', () => {
    const result = typescriptDetector(INVALID_TSCONFIG)

    // Should still detect TypeScript but strictMode should be undefined
    expect(result).not.toBeNull()
    expect(result?.id).toBe('typescript')
    // strictMode should be undefined or false when tsconfig is invalid
    expect(result?.strictMode === undefined || result?.strictMode === false).toBe(true)
  })

  it('handles non-existent tsconfig gracefully', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    }
    // Path without tsconfig.json
    const result = typescriptDetector('/non/existent/path', pkg)

    expect(result).not.toBeNull()
    expect(result?.strictMode).toBeUndefined()
  })
})
