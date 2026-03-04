import { resolve } from 'node:path'

// Mock the NX module to control workspace detection
jest.mock('./nx', () => ({
  isNxWorkspace: jest.fn(() => false),
  findNxWorkspaceRoot: jest.fn(() => null),
}))

import { analyzeProject } from './analyze'

const FIXTURES_DIR = resolve(__dirname, '../__fixtures__')

describe('analyzeProject workspace type detection (mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when NX detection is disabled', () => {
    it('detects turborepo workspace type', () => {
      const turborepoDir = resolve(FIXTURES_DIR, 'turborepo-workspace')
      const result = analyzeProject(turborepoDir)
      expect(result.workspaceType).toBe('turborepo')
    })

    it('detects lerna workspace type', () => {
      const lernaDir = resolve(FIXTURES_DIR, 'lerna-workspace')
      const result = analyzeProject(lernaDir)
      expect(result.workspaceType).toBe('lerna')
    })

    it('detects pnpm workspace type', () => {
      const pnpmDir = resolve(FIXTURES_DIR, 'pnpm-workspace')
      const result = analyzeProject(pnpmDir)
      expect(result.workspaceType).toBe('pnpm')
    })

    it('detects yarn workspace type with yarn.lock', () => {
      const yarnDir = resolve(FIXTURES_DIR, 'yarn-workspace')
      const result = analyzeProject(yarnDir)
      expect(result.workspaceType).toBe('yarn')
    })

    it('detects npm workspace type with package-lock.json', () => {
      const npmDir = resolve(FIXTURES_DIR, 'npm-workspace')
      const result = analyzeProject(npmDir)
      expect(result.workspaceType).toBe('npm')
    })

    it('detects standalone for minimal project without workspace markers', () => {
      const minimalDir = resolve(FIXTURES_DIR, 'minimal-project')
      const result = analyzeProject(minimalDir)
      expect(result.workspaceType).toBe('standalone')
    })

    it('detects standalone for project without package.json workspaces field', () => {
      const bareDir = resolve(FIXTURES_DIR, 'bare-package')
      const result = analyzeProject(bareDir)
      expect(result.workspaceType).toBe('standalone')
    })
  })

  describe('verbose mode', () => {
    it('enables verbose logging and completes analysis', () => {
      const minimalDir = resolve(FIXTURES_DIR, 'minimal-project')
      const result = analyzeProject(minimalDir, { verbose: true })
      expect(result).toBeDefined()
      expect(result.projectType).toBeDefined()
      expect(result.metadata).toBeDefined()
    })
  })

  describe('detectProjectType edge cases', () => {
    it('handles project with unusual structure', () => {
      const emptyDir = resolve(FIXTURES_DIR, 'empty')
      const result = analyzeProject(emptyDir)
      expect(result).toBeDefined()
      expect(['application', 'library', 'e2e', 'tool', 'plugin', 'unknown']).toContain(result.projectType)
    })

    it('handles project with no markers', () => {
      const noMarkersDir = resolve(FIXTURES_DIR, 'no-markers-project')
      const result = analyzeProject(noMarkersDir)
      expect(result).toBeDefined()
      expect(result.projectType).toBeDefined()
    })
  })
})
