import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { analyzeProject } from './analyze'

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')

describe('analyzeProject', () => {
  describe('with minimal-project fixture', () => {
    it('returns complete analysis result', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      expect(result).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          root: expect.any(String),
          projectType: expect.any(String),
          workspaceType: expect.any(String),
          frameworks: expect.any(Array),
          buildTools: expect.any(Array),
          testingFrameworks: expect.any(Array),
          entryPoints: expect.any(Array),
          configFiles: expect.any(Array),
          dependencies: expect.any(Object),
          metadata: expect.any(Object),
        })
      )
    })

    it('includes correct project name', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      expect(result.name).toBe('minimal-test-project')
    })

    it('includes resolved root path', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      expect(result.root).toBe(MINIMAL_PROJECT)
    })

    it('detects project type', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      expect(['application', 'library', 'e2e', 'tool', 'plugin', 'unknown']).toContain(result.projectType)
    })

    it('includes metadata with timestamp, duration and version', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      expect(result.metadata).toEqual({
        timestamp: expect.any(Date),
        durationMs: expect.any(Number),
        version: expect.any(String),
      })
    })

    it('reports a non-negative analysis duration', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('returns arrays for collections', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      expect(result).toEqual(
        expect.objectContaining({
          frameworks: expect.any(Array),
          buildTools: expect.any(Array),
          testingFrameworks: expect.any(Array),
          entryPoints: expect.any(Array),
          configFiles: expect.any(Array),
        })
      )
    })

    it('returns dependency summary with counts', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      expect(result.dependencies).toEqual({
        production: expect.any(Number),
        development: expect.any(Number),
        peer: expect.any(Number),
        optional: expect.any(Number),
        total: expect.any(Number),
      })
    })
  })

  describe('with monorepo fixture', () => {
    it('detects nx workspace type', () => {
      const result = analyzeProject(MONOREPO)
      expect(result.workspaceType).toBe('nx')
    })
  })

  describe('options.depth', () => {
    it('still resolves a project type at basic depth', () => {
      const result = analyzeProject(MINIMAL_PROJECT, { depth: 'basic' })
      expect(result.projectType).toBeDefined()
    })

    it('resolves a project type at full depth', () => {
      const result = analyzeProject(MINIMAL_PROJECT, { depth: 'full' })
      expect(result.projectType).toBeDefined()
    })
  })

  describe('options.include', () => {
    it('only runs included analyses', () => {
      const result = analyzeProject(MINIMAL_PROJECT, {
        include: ['frameworks'],
      })

      expect(result).toEqual(
        expect.objectContaining({
          frameworks: expect.any(Array),
          buildTools: [],
          testingFrameworks: [],
          entryPoints: [],
          configFiles: [],
          dependencies: { production: 0, development: 0, peer: 0, optional: 0, total: 0 },
        })
      )
    })
  })

  describe('options.exclude', () => {
    it('zeroes the dependency summary when dependencies are excluded', () => {
      const result = analyzeProject(MINIMAL_PROJECT, {
        exclude: ['dependencies'],
      })

      expect(result.dependencies).toEqual({ production: 0, development: 0, peer: 0, optional: 0, total: 0 })
    })

    it('still detects the project type when dependencies are excluded', () => {
      const result = analyzeProject(MINIMAL_PROJECT, {
        exclude: ['dependencies'],
      })

      expect(result.projectType).toBeDefined()
    })
  })

  describe('framework detection results', () => {
    it('frameworks have required properties', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      for (const framework of result.frameworks) {
        expect(framework).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            confidence: expect.any(Number),
            category: expect.stringMatching(/^(?:frontend|backend|fullstack)$/),
          })
        )
      }
    })
  })

  describe('build tool detection results', () => {
    it('build tools have required properties', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      for (const tool of result.buildTools) {
        expect(tool).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            confidence: expect.any(Number),
          })
        )
      }
    })
  })

  describe('entry point detection results', () => {
    it('entry points have required properties', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      for (const entry of result.entryPoints) {
        expect(entry).toEqual(
          expect.objectContaining({
            path: expect.any(String),
            type: expect.stringMatching(/^(?:main|app|server|cli|test)$/),
            confidence: expect.any(Number),
          })
        )
      }
    })
  })

  describe('config file detection results', () => {
    it('config files have required properties', () => {
      const result = analyzeProject(MINIMAL_PROJECT)

      for (const config of result.configFiles) {
        expect(config).toEqual(
          expect.objectContaining({
            path: expect.any(String),
            name: expect.any(String),
            format: expect.stringMatching(/^(?:json|yaml|js|ts|toml|env)$/),
          })
        )
      }
    })
  })

  describe('workspace type detection', () => {
    // Note: These fixtures are inside the hyperfrontend NX workspace, so they detect as 'nx'

    it('detects nx workspace type (fixtures inherit parent workspace)', () => {
      const turborepoDir = resolve(FIXTURES_DIR, 'turborepo-workspace')
      const result = analyzeProject(turborepoDir)
      expect(result.workspaceType).toBe('nx')
    })

    it('detects actual monorepo fixture as nx', () => {
      const result = analyzeProject(MONOREPO)
      expect(result.workspaceType).toBe('nx')
    })

    it('returns valid workspace type for all fixtures', () => {
      const validTypes = ['nx', 'turborepo', 'lerna', 'pnpm', 'npm', 'yarn', 'rush', 'standalone', 'unknown']
      const result = analyzeProject(MINIMAL_PROJECT)
      expect(validTypes).toContain(result.workspaceType)
    })
  })

  describe('options.verbose', () => {
    it('enables verbose logging when verbose option is true', () => {
      const result = analyzeProject(MINIMAL_PROJECT, { verbose: true })
      expect(result).toEqual(expect.objectContaining({ projectType: expect.any(String) }))
    })
  })

  describe('config format normalization', () => {
    it('normalizes various config formats to standard types', () => {
      const result = analyzeProject(MINIMAL_PROJECT)
      for (const config of result.configFiles) {
        expect(['json', 'yaml', 'js', 'ts', 'toml', 'env']).toContain(config.format)
      }
    })

    it('derives the format from the file extension when the pattern declares none', () => {
      const result = analyzeProject(resolve(FIXTURES_DIR, 'vitest-project'))
      const vitestConfig = result.configFiles.find((config) => config.name === 'vitest.config.ts')
      expect(vitestConfig?.format).toBe('ts')
    })
  })

  describe('empty project handling', () => {
    it('handles empty project directory', () => {
      const emptyDir = resolve(FIXTURES_DIR, 'empty')
      const result = analyzeProject(emptyDir)
      expect(result).toEqual(expect.objectContaining({ projectType: expect.any(String) }))
    })
  })
})
