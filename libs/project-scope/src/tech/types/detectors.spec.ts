import type { PackageJson } from '../../project/package'
import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { detectTypeSystems, flowDetector, jsdocDetector, typescriptDetector, typeSystemDetectors } from './detectors'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const TYPESCRIPT_STRICT = resolve(FIXTURES_DIR, 'typescript-strict')
const FLOW_PROJECT = resolve(FIXTURES_DIR, 'flow-project')
const JSDOC_PROJECT = resolve(FIXTURES_DIR, 'jsdoc-project')
const JSCONFIG_PROJECT = resolve(FIXTURES_DIR, 'jsconfig-project')

describe('typescriptDetector', () => {
  it('returns null when typescript is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(typescriptDetector('/some/path', pkg)).toBeNull()
  })

  it('detects typescript from a devDependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    }
    expect(typescriptDetector('/some/path', pkg)).toEqual(expect.objectContaining({ id: 'typescript', version: '5.0.0' }))
  })

  it('scores a typescript devDependency at 50 or more', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    }
    expect(typescriptDetector('/some/path', pkg)?.confidence).toBeGreaterThanOrEqual(50)
  })

  it('detects typescript in dependencies', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { typescript: '^5.0.0' },
    }
    expect(typescriptDetector('/some/path', pkg)).toEqual(expect.objectContaining({ id: 'typescript' }))
  })
})

describe('flowDetector', () => {
  it('returns null when flow is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(flowDetector('/some/path', pkg)).toBeNull()
  })

  it('detects flow from a flow-bin devDependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { 'flow-bin': '^0.220.0' },
    }
    expect(flowDetector('/some/path', pkg)).toEqual(expect.objectContaining({ id: 'flow', version: '0.220.0' }))
  })

  it('scores a flow-bin devDependency at 60 or more', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { 'flow-bin': '^0.220.0' },
    }
    expect(flowDetector('/some/path', pkg)?.confidence).toBeGreaterThanOrEqual(60)
  })
})

describe('jsdocDetector', () => {
  it('returns null when jsdoc is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(jsdocDetector('/some/path', pkg)).toBeNull()
  })

  it('detects jsdoc from a jsdoc devDependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { jsdoc: '^4.0.0' },
    }
    expect(jsdocDetector('/some/path', pkg)).toEqual(expect.objectContaining({ id: 'jsdoc' }))
  })

  it('scores a jsdoc devDependency at 30 or more', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { jsdoc: '^4.0.0' },
    }
    expect(jsdocDetector('/some/path', pkg)?.confidence).toBeGreaterThanOrEqual(30)
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
    expect(detectTypeSystems('/some/path', pkg)).toEqual([expect.objectContaining({ id: 'typescript' })])
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
    const ids = detectTypeSystems('/some/path', pkg).map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(['typescript', 'jsdoc']))
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
    const detectorShape = expect.objectContaining({ id: expect.any(String), name: expect.any(String), detect: expect.any(Function) })
    expect(typeSystemDetectors).toEqual([detectorShape, detectorShape, detectorShape])
  })
})

describe('typescriptDetector with fixtures', () => {
  it('reports tsconfig.json as the config path', () => {
    expect(typescriptDetector(TYPESCRIPT_STRICT)).toEqual(expect.objectContaining({ configPath: 'tsconfig.json' }))
  })

  it('scores a project with tsconfig.json at 90 or more', () => {
    expect(typescriptDetector(TYPESCRIPT_STRICT)?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('detects strict mode from tsconfig', () => {
    const result = typescriptDetector(TYPESCRIPT_STRICT)

    expect(result?.strictMode).toBe(true)
  })

  it('scores @types packages beside typescript at 60 or more', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        '@types/react': '^18.0.0',
      },
    }
    expect(typescriptDetector('/some/path', pkg)?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('records @types packages as a detection source', () => {
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

    expect(result?.detectedFrom.some((s) => s.field?.includes('@types'))).toBe(true)
  })

  it('detects tsconfig variants', () => {
    const result = typescriptDetector(TYPESCRIPT_STRICT)

    expect(result?.detectedFrom.some((s) => s.path?.includes('tsconfig.build.json'))).toBe(true)
  })
})

describe('flowDetector with fixtures', () => {
  it('detects .flowconfig presence', () => {
    expect(flowDetector(FLOW_PROJECT)).toEqual(expect.objectContaining({ configPath: '.flowconfig' }))
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

    expect(result?.detectedFrom.some((s) => s.field?.includes('@babel/preset-flow'))).toBe(true)
  })
})

describe('jsdocDetector with fixtures', () => {
  it('detects checkJs/allowJs in tsconfig', () => {
    const result = jsdocDetector(JSDOC_PROJECT)

    expect(result?.detectedFrom.some((s) => s.path?.includes('checkJs') || s.path?.includes('allowJs'))).toBe(true)
  })

  it('records jsconfig.json as a detection source', () => {
    const result = jsdocDetector(JSCONFIG_PROJECT)

    expect(result?.detectedFrom.some((s) => s.path?.includes('jsconfig.json'))).toBe(true)
  })

  it('scores a project with jsconfig.json at 40 or more', () => {
    expect(jsdocDetector(JSCONFIG_PROJECT)?.confidence).toBeGreaterThanOrEqual(40)
  })

  it('detects JSDoc annotations in source files', () => {
    const result = jsdocDetector(JSDOC_PROJECT)

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

    expect(results.find((r) => r.id === 'typescript')?.strictMode).toBe(true)
  })

  it('detects Flow with all indicators', () => {
    const results = detectTypeSystems(FLOW_PROJECT)

    expect(results.find((r) => r.id === 'flow')?.confidence).toBeGreaterThanOrEqual(100)
  })

  it('detects JSDoc with jsconfig', () => {
    const results = detectTypeSystems(JSCONFIG_PROJECT)

    const jsdocResult = results.find((r) => r.id === 'jsdoc')
    expect(jsdocResult).toBeDefined()
  })
})

const INVALID_TSCONFIG = resolve(FIXTURES_DIR, 'invalid-tsconfig')

describe('typescriptDetector edge cases', () => {
  it('still detects typescript when tsconfig.json is invalid', () => {
    expect(typescriptDetector(INVALID_TSCONFIG)).toEqual(expect.objectContaining({ id: 'typescript' }))
  })

  it('does not report strict mode when tsconfig.json is invalid', () => {
    expect(typescriptDetector(INVALID_TSCONFIG)?.strictMode).not.toBe(true)
  })

  it('handles non-existent tsconfig gracefully', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    }
    expect(typescriptDetector('/non/existent/path', pkg)).toEqual(expect.objectContaining({ id: 'typescript', strictMode: undefined }))
  })
})
