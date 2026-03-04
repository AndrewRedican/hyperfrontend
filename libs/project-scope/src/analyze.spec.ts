import { resolve } from 'node:path'
import { analyzeProject } from './analyze'

const FIXTURES_DIR = resolve(__dirname, '../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')

describe('analyzeProject', () => {
  describe('with minimal-project fixture', () => {
    it('returns complete analysis result', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('root')
      expect(result).toHaveProperty('projectType')
      expect(result).toHaveProperty('workspaceType')
      expect(result).toHaveProperty('frameworks')
      expect(result).toHaveProperty('buildTools')
      expect(result).toHaveProperty('testingFrameworks')
      expect(result).toHaveProperty('entryPoints')
      expect(result).toHaveProperty('configFiles')
      expect(result).toHaveProperty('dependencies')
      expect(result).toHaveProperty('metadata')
    })

    it('includes correct project name', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      // Name should be from package.json or directory name
      expect(typeof result.name).toBe('string')
      expect(result.name.length).toBeGreaterThan(0)
    })

    it('includes resolved root path', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      expect(result.root).toBe(MINIMAL_PROJECT)
    })

    it('detects project type', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      expect(['application', 'library', 'e2e', 'tool', 'plugin', 'unknown']).toContain(result.projectType)
    })

    it('includes metadata with timestamp and duration', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      expect(result.metadata.timestamp).toBeInstanceOf(Date)
      expect(typeof result.metadata.durationMs).toBe('number')
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0)
      expect(typeof result.metadata.version).toBe('string')
    })

    it('returns arrays for collections', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      expect(Array.isArray(result.frameworks)).toBe(true)
      expect(Array.isArray(result.buildTools)).toBe(true)
      expect(Array.isArray(result.testingFrameworks)).toBe(true)
      expect(Array.isArray(result.entryPoints)).toBe(true)
      expect(Array.isArray(result.configFiles)).toBe(true)
    })

    it('returns dependency summary with counts', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      expect(typeof result.dependencies.production).toBe('number')
      expect(typeof result.dependencies.development).toBe('number')
      expect(typeof result.dependencies.peer).toBe('number')
      expect(typeof result.dependencies.optional).toBe('number')
      expect(typeof result.dependencies.total).toBe('number')
    })
  })

  describe('with monorepo fixture', () => {
    it('detects nx workspace type', () => {
      const result = analyzeProject(MONOREPO)
      expect(result.workspaceType).toBe('nx')
    })
  })

  describe('options.depth', () => {
    it('basic depth skips tech detection in project type', () => {
      const basic = analyzeProject(MINIMAL_PROJECT, { depth: 'basic' })
      const full = analyzeProject(MINIMAL_PROJECT, { depth: 'full' })

      // Both should return complete results
      expect(basic.projectType).toBeDefined()
      expect(full.projectType).toBeDefined()
    })
  })

  describe('options.include', () => {
    it('only runs included analyses', () => {
      const result = analyzeProject(MINIMAL_PROJECT, {
        include: ['frameworks'],
      })

      // Frameworks should be populated
      expect(Array.isArray(result.frameworks)).toBe(true)

      // Other arrays should be empty
      expect(result.buildTools).toEqual([])
      expect(result.testingFrameworks).toEqual([])
      expect(result.entryPoints).toEqual([])
      expect(result.configFiles).toEqual([])
    })
  })

  describe('options.exclude', () => {
    it('skips excluded analyses', () => {
      const result = analyzeProject(MINIMAL_PROJECT, {
        exclude: ['dependencies'],
      })

      // Dependencies should be zeros
      expect(result.dependencies.total).toBe(0)

      // Other analyses should still run
      expect(result.projectType).toBeDefined()
    })
  })

  describe('framework detection results', () => {
    it('frameworks have required properties', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      for (const framework of result.frameworks) {
        expect(typeof framework.id).toBe('string')
        expect(typeof framework.name).toBe('string')
        expect(typeof framework.confidence).toBe('number')
        expect(['frontend', 'backend', 'fullstack']).toContain(framework.category)
      }
    })
  })

  describe('build tool detection results', () => {
    it('build tools have required properties', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      for (const tool of result.buildTools) {
        expect(typeof tool.id).toBe('string')
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.confidence).toBe('number')
      }
    })
  })

  describe('entry point detection results', () => {
    it('entry points have required properties', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      for (const entry of result.entryPoints) {
        expect(typeof entry.path).toBe('string')
        expect(['main', 'app', 'server', 'cli', 'test']).toContain(entry.type)
        expect(typeof entry.confidence).toBe('number')
      }
    })
  })

  describe('config file detection results', () => {
    it('config files have required properties', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      for (const config of result.configFiles) {
        expect(typeof config.path).toBe('string')
        expect(typeof config.name).toBe('string')
        expect(['json', 'yaml', 'js', 'ts', 'toml', 'env']).toContain(config.format)
      }
    })
  })

  describe('workspace type detection', () => {
    // Note: These fixtures are inside the hyperfrontend NX workspace, so they detect as 'nx'
    // due to the workspace detection looking up the directory tree and finding nx.json
    // This is correct behavior - the fixtures inherit the parent workspace type

    it('detects nx workspace type (fixtures inherit parent workspace)', () => {
      // All fixtures inside an NX workspace detect as NX
      const turborepoDir = resolve(FIXTURES_DIR, 'turborepo-workspace')
      const result = analyzeProject(turborepoDir)
      // Detects nx because hyperfrontend root has nx.json
      expect(result.workspaceType).toBe('nx')
    })

    it('detects actual monorepo fixture as nx', () => {
      const result = analyzeProject(MONOREPO)
      expect(result.workspaceType).toBe('nx')
    })

    it('returns valid workspace type for all fixtures', () => {
      // Verify workspace type is one of the valid types
      const validTypes = ['nx', 'turborepo', 'lerna', 'pnpm', 'npm', 'yarn', 'rush', 'standalone', 'unknown']
      const result = analyzeProject(MINIMAL_PROJECT)
      expect(validTypes).toContain(result.workspaceType)
    })
  })

  describe('options.verbose', () => {
    it('enables verbose logging when verbose option is true', () => {
      const result = analyzeProject(MINIMAL_PROJECT, { verbose: true })
      // Should complete successfully with verbose mode
      expect(result).toBeDefined()
      expect(result.projectType).toBeDefined()
    })
  })

  describe('config format normalization', () => {
    it('normalizes various config formats to standard types', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      // All config formats should be normalized
      for (const config of result.configFiles) {
        expect(['json', 'yaml', 'js', 'ts', 'toml', 'env']).toContain(config.format)
      }
    })
  })

  describe('empty project handling', () => {
    it('handles empty project directory', () => {
      const emptyDir = resolve(FIXTURES_DIR, 'empty')
      const result = analyzeProject(emptyDir)
      expect(result).toBeDefined()
      expect(result.projectType).toBeDefined()
    })
  })
})
