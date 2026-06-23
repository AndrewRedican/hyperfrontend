/**
 * Tests for analyze.ts coverage branches.
 * Uses Jest mocks to ensure specific branches are covered.
 */
import { resolve } from 'node:path'
import * as analyzeModule from '../../analyze'
import { analyzeCommand } from './analyze'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

jest.mock('../../analyze', () => {
  const actual = jest.requireActual('../../analyze')
  return {
    ...actual,
    analyzeProject: jest.fn().mockImplementation(actual.analyzeProject),
  }
})

const mockAnalyzeProject = analyzeModule.analyzeProject as jest.MockedFunction<typeof analyzeModule.analyzeProject>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('analyzeCommand meta-frameworks branch (L72)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual('../../analyze').analyzeProject)
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

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('React')
    expect(result.output).toContain('Next.js')
    expect(result.output).toContain('Remix')
    expect(result.output).toMatch(/\s+-\s+Next\.js/)
    expect(result.output).toMatch(/\s+-\s+Remix/)
  })
})

describe('analyzeCommand build tools formatting (L80-85)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual('../../analyze').analyzeProject)
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

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Build Tools:')
    expect(result.output).toContain('Webpack 5.88.0')
    expect(result.output).toContain('Babel 7.22.0')
    expect(result.output).toContain('ESBuild 0.18.0')
  })

  it('displays build tools without version when version is undefined', () => {
    const mockResult = createMockResult({
      buildTools: [{ id: 'vite', name: 'Vite', confidence: 90 }],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT })

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Vite')
  })
})

describe('analyzeCommand entry points truncation (L103)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual('../../analyze').analyzeProject)
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

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Entry Points:')
    expect(result.output).toContain('src/index.ts')
    expect(result.output).toContain('src/worker.ts')
    expect(result.output).toContain('... and 3 more')
    expect(result.output).not.toContain('src/utils.ts')
  })
})

describe('analyzeCommand config files truncation (L114)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual('../../analyze').analyzeProject)
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

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Configurations:')
    expect(result.output).toContain('package.json')
    expect(result.output).toContain('postcss.config.js')
    expect(result.output).toContain('... and 3 more')
    expect(result.output).not.toContain('webpack.config.js')
  })
})

describe('analyzeCommand YAML toYaml branches (L171, L185)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockAnalyzeProject.mockImplementation(jest.requireActual('../../analyze').analyzeProject)
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

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('dependencies:')
    expect(result.output).toMatch(/\s+production: 5/)
    expect(result.output).toMatch(/\s+development: 10/)
    expect(result.output).toContain('metadata:')
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

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('frameworks:')
    expect(result.output).toMatch(/-\s+.*name:\s*React/s)
  })

  it('handles strings with special characters in YAML', () => {
    const mockResult = createMockResult({
      name: 'project:with:colons',
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('"project:with:colons"')
  })

  it('handles empty arrays in YAML', () => {
    const mockResult = createMockResult({
      frameworks: [],
      buildTools: [],
    })

    mockAnalyzeProject.mockReturnValueOnce(mockResult)

    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })

    expect(result.exitCode).toBe(0)
    expect(result.output).toMatch(/frameworks: \[\]/)
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

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('frameworks:')
    expect(result.output).toContain('buildTools:')
    expect(result.output).toMatch(/-\s+.*name:/s)
  })
})
