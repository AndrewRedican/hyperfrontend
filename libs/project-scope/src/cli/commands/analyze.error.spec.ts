/**
 * Tests for analyze.ts coverage branches.
 * Uses Jest mocks to ensure specific branches are covered.
 */
import type { MockedFunction } from '@hyperfrontend/testing'
import { resolve } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as analyzeModule from '../../analyze'
import { analyzeCommand } from './analyze'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

jest.mock('../../analyze', () => {
  const actual = jest.requireActual<typeof import('../../analyze')>('../../analyze')
  return {
    ...actual,
    analyzeProject: jest.fn().mockImplementation(actual.analyzeProject),
  }
})

const mockAnalyzeProject = analyzeModule.analyzeProject as MockedFunction<typeof analyzeModule.analyzeProject>

// lint-disable-next-line typescript/no-explicit-any
function createMockResult(overrides: Record<string, any> = {}): ReturnType<typeof analyzeModule.analyzeProject> {
  return {
    name: 'test-project',
    root: MINIMAL_PROJECT,
    projectType: 'application',
    workspaceType: 'standalone',
    frameworks: [],
    buildTools: [],
    testingFrameworks: [],
    entryPoints: [],
    configFiles: [],
    dependencies: { production: 0, development: 0, peer: 0, optional: 0, total: 0 },
    metadata: { timestamp: new Date(), durationMs: 100, version: '1.0.0' },
    ...overrides,
    // lint-disable-next-line typescript/no-explicit-any
  } as any
}

describe('analyzeCommand meta-frameworks branch (L72)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual<typeof import('../../analyze')>('../../analyze').analyzeProject)
  })

  it('displays meta-frameworks with indentation when framework has metaFrameworks', () => {
    const mockResult = createMockResult({
      frameworks: [
        {
          id: 'react',
          name: 'React',
          version: '18.0.0',
          confidence: 95,
          category: 'frontend',
          metaFrameworks: ['Next.js', 'Remix'],
        },
      ],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT })

    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining('Frameworks:\n  * React 18.0.0 (confidence: 95%)\n    - Next.js\n    - Remix\n'),
    })
  })
})

describe('analyzeCommand build tools formatting (L80-85)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual<typeof import('../../analyze')>('../../analyze').analyzeProject)
  })

  it('displays multiple build tools with versions', () => {
    const mockResult = createMockResult({
      buildTools: [
        { id: 'webpack', name: 'Webpack', version: '5.88.0', confidence: 90 },
        { id: 'babel', name: 'Babel', version: '7.22.0', confidence: 85 },
        { id: 'esbuild', name: 'ESBuild', version: '0.18.0', confidence: 80 },
      ],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT })

    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining('Build Tools:\n  * Webpack 5.88.0\n  * Babel 7.22.0\n  * ESBuild 0.18.0\n'),
    })
  })

  it('displays build tools without version when version is undefined', () => {
    const mockResult = createMockResult({
      buildTools: [{ id: 'vite', name: 'Vite', confidence: 90 }],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT })

    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('Build Tools:\n  * Vite\n') })
  })
})

describe('analyzeCommand entry points truncation (L103)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual<typeof import('../../analyze')>('../../analyze').analyzeProject)
  })

  it('truncates entry points when more than 5 and shows count', () => {
    const mockResult = createMockResult({
      entryPoints: [
        { path: 'src/index.ts', type: 'main', confidence: 90 },
        { path: 'src/app.ts', type: 'main', confidence: 90 },
        { path: 'src/server.ts', type: 'main', confidence: 90 },
        { path: 'src/cli.ts', type: 'main', confidence: 90 },
        { path: 'src/worker.ts', type: 'main', confidence: 90 },
        { path: 'src/background.ts', type: 'main', confidence: 90 },
        { path: 'src/utils.ts', type: 'main', confidence: 90 },
        { path: 'src/helpers.ts', type: 'main', confidence: 90 },
      ],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT })

    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining(
        [
          'Entry Points:',
          '  * src/index.ts (main)',
          '  * src/app.ts (main)',
          '  * src/server.ts (main)',
          '  * src/cli.ts (main)',
          '  * src/worker.ts (main)',
          '  ... and 3 more',
          '',
          'Dependencies:',
        ].join('\n')
      ),
    })
  })
})

describe('analyzeCommand config files truncation (L114)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual<typeof import('../../analyze')>('../../analyze').analyzeProject)
  })

  it('truncates config files when more than 8 and shows count', () => {
    const mockResult = createMockResult({
      configFiles: [
        { name: 'package.json', path: 'package.json', format: 'json' },
        { name: 'tsconfig.json', path: 'tsconfig.json', format: 'json' },
        { name: 'eslint.config.js', path: 'eslint.config.js', format: 'js' },
        { name: 'prettier.config.js', path: 'prettier.config.js', format: 'js' },
        { name: 'jest.config.js', path: 'jest.config.js', format: 'js' },
        { name: 'vite.config.ts', path: 'vite.config.ts', format: 'ts' },
        { name: 'tailwind.config.js', path: 'tailwind.config.js', format: 'js' },
        { name: 'postcss.config.js', path: 'postcss.config.js', format: 'js' },
        { name: 'babel.config.js', path: 'babel.config.js', format: 'js' },
        { name: 'webpack.config.js', path: 'webpack.config.js', format: 'js' },
        { name: '.env', path: '.env', format: 'env' },
      ],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT })

    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining(
        [
          'Configurations:',
          '  * package.json',
          '  * tsconfig.json',
          '  * eslint.config.js',
          '  * prettier.config.js',
          '  * jest.config.js',
          '  * vite.config.ts',
          '  * tailwind.config.js',
          '  * postcss.config.js',
          '  ... and 3 more',
          '',
          'Dependencies:',
        ].join('\n')
      ),
    })
  })
})

describe('analyzeCommand YAML toYaml branches (L171, L185)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual<typeof import('../../analyze')>('../../analyze').analyzeProject)
  })

  it('handles nested objects in YAML output', () => {
    const mockResult = createMockResult({
      projectType: 'library',
      workspaceType: 'nx',
      dependencies: { production: 5, development: 10, peer: 2, optional: 0, total: 17 },
      metadata: { timestamp: new Date('2024-01-15'), durationMs: 150, version: '1.0.0' },
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })

    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining(
        'dependencies:\n  production: 5\n  development: 10\n  peer: 2\n  optional: 0\n  total: 17\nmetadata:\n'
      ),
    })
  })

  it('handles arrays with items in YAML output', () => {
    const mockResult = createMockResult({
      frameworks: [
        { id: 'react', name: 'React', version: '18.0.0', confidence: 95, category: 'frontend' },
        { id: 'vue', name: 'Vue', version: '3.0.0', confidence: 85, category: 'frontend' },
      ],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })

    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining(
        [
          'frameworks:',
          '  - id: react',
          '    name: React',
          '    version: 18.0.0',
          '    confidence: 95',
          '    category: frontend',
          '  - id: vue',
          '    name: Vue',
          '    version: 3.0.0',
          '    confidence: 85',
          '    category: frontend',
          'buildTools: []',
        ].join('\n')
      ),
    })
  })

  it('handles strings with special characters in YAML', () => {
    const mockResult = createMockResult({
      name: 'project:with:colons',
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })

    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('name: "project:with:colons"\n') })
  })

  it('handles empty arrays in YAML', () => {
    const mockResult = createMockResult({
      frameworks: [],
      buildTools: [],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })

    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('frameworks: []\nbuildTools: []\n') })
  })

  it('handles deeply nested objects requiring prefix indentation', () => {
    const mockResult = createMockResult({
      name: 'nested-test',
      frameworks: [
        {
          id: 'react',
          name: 'React',
          version: '18.0.0',
          confidence: 95,
          category: 'frontend',
          metaFrameworks: ['Next.js'],
        },
      ],
      buildTools: [{ id: 'webpack', name: 'Webpack', version: '5.0.0', confidence: 90 }],
      testingFrameworks: [{ id: 'jest', name: 'Jest', version: '29.0.0', confidence: 95, type: 'unit' }],
      entryPoints: [{ path: 'src/index.ts', type: 'main', confidence: 90 }],
      configFiles: [{ name: 'package.json', path: 'package.json', format: 'json' }],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })

    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining(
        [
          'frameworks:',
          '  - id: react',
          '    name: React',
          '    version: 18.0.0',
          '    confidence: 95',
          '    category: frontend',
          '    metaFrameworks:',
          '      - Next.js',
          'buildTools:',
          '  - id: webpack',
          '    name: Webpack',
          '    version: 5.0.0',
          '    confidence: 90',
          'testingFrameworks:',
        ].join('\n')
      ),
    })
  })
})
