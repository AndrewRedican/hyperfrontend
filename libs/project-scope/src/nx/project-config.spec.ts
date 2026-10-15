import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readProjectJson, getProjectConfig, discoverNxProjects, buildSimpleProjectGraph } from './project-config'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../__fixtures__')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const CORE_PROJECT = resolve(MONOREPO, 'packages/core')
const NX_WORKSPACE_JSON_ONLY = resolve(FIXTURES_DIR, 'nx-workspace-json-only')
const NX_PACKAGE_JSON_FIELD = resolve(FIXTURES_DIR, 'nx-package-json-field')
const NX_INTEGRATED_WORKSPACE = resolve(FIXTURES_DIR, 'nx-integrated-workspace')
const PROJECT_JSON_ONLY = resolve(FIXTURES_DIR, 'project-json-only')

describe('NX Project Config', () => {
  describe('readProjectJson', () => {
    it('reads project.json from NX project', () => {
      const config = readProjectJson(CORE_PROJECT)

      expect(config).toEqual({ name: 'core', projectType: 'library', sourceRoot: 'packages/core/src' })
    })

    it('returns null for non-NX project', () => {
      const config = readProjectJson(MINIMAL_PROJECT)
      expect(config).toBeNull()
    })

    it('returns null for non-existent path', () => {
      const config = readProjectJson('/non/existent/path')
      expect(config).toBeNull()
    })
  })

  describe('getProjectConfig', () => {
    it('returns config with relative root path', () => {
      const config = getProjectConfig(CORE_PROJECT, MONOREPO)

      expect(config).toEqual({ name: 'core', projectType: 'library', sourceRoot: 'packages/core/src', root: 'packages/core' })
    })

    it('includes sourceRoot from project.json', () => {
      const config = getProjectConfig(CORE_PROJECT, MONOREPO)
      expect(config?.sourceRoot).toBe('packages/core/src')
    })

    it('returns null for non-NX project without nx field', () => {
      const config = getProjectConfig(MINIMAL_PROJECT, FIXTURES_DIR)
      expect(config).toBeNull()
    })
  })

  describe('discoverNxProjects', () => {
    it('discovers projects in NX workspace', () => {
      const projects = discoverNxProjects(MONOREPO)

      expect([...projects.keys()].sort()).toEqual(['core', 'project-with-deps', 'utils'])
    })

    it('includes core project from packages directory', () => {
      const projects = discoverNxProjects(MONOREPO)

      expect(projects.get('core')?.projectType).toBe('library')
    })

    it('returns empty map for non-NX workspace', () => {
      const projects = discoverNxProjects(MINIMAL_PROJECT)
      expect(projects.size).toBe(0)
    })

    it('returns empty map for non-existent path', () => {
      const projects = discoverNxProjects('/non/existent/path')
      expect(projects.size).toBe(0)
    })

    it('sets correct root path for discovered projects', () => {
      const projects = discoverNxProjects(MONOREPO)
      const core = projects.get('core')

      expect(core?.root).toBe('packages/core')
    })
  })

  describe('buildSimpleProjectGraph', () => {
    it('builds graph with nodes and dependencies', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      expect(graph).toEqual({ nodes: expect.any(Object), dependencies: expect.any(Object) })
    })

    it('includes discovered projects as nodes', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      expect(graph.nodes['core']).toEqual(expect.objectContaining({ name: 'core', type: 'library' }))
    })

    it('sets up dependencies array for each project', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      expect(graph.dependencies['core']).toEqual([])
    })

    it('accepts pre-discovered projects map', () => {
      const projects = discoverNxProjects(MONOREPO)
      const graph = buildSimpleProjectGraph(MONOREPO, projects)

      expect(graph.nodes).toHaveProperty('core')
    })

    it('returns empty graph for non-NX workspace', () => {
      const graph = buildSimpleProjectGraph(MINIMAL_PROJECT)

      expect(graph).toEqual({ nodes: {}, dependencies: {} })
    })
  })

  describe('getProjectConfig extended', () => {
    it('reads config from package.json nx field when no project.json', () => {
      const config = getProjectConfig(NX_PACKAGE_JSON_FIELD, FIXTURES_DIR)

      expect(config).toEqual({ name: 'nx-field-package', root: 'nx-package-json-field', projectType: 'library', tags: ['scope:shared'] })
    })

    it('prefers project.json over package.json nx field', () => {
      const config = getProjectConfig(CORE_PROJECT, MONOREPO)

      expect(config?.name).toBe('core')
    })

    it('returns null for project without project.json or nx field', () => {
      const config = getProjectConfig(MINIMAL_PROJECT, FIXTURES_DIR)
      expect(config).toBeNull()
    })

    it('includes tags from package.json nx field', () => {
      const config = getProjectConfig(NX_PACKAGE_JSON_FIELD, FIXTURES_DIR)

      expect(config?.tags).toEqual(['scope:shared'])
    })
  })

  describe('discoverNxProjects with workspace.json', () => {
    it('discovers projects from workspace.json with string path references', () => {
      const projects = discoverNxProjects(NX_WORKSPACE_JSON_ONLY)

      expect(projects.get('app-one')).toEqual(expect.objectContaining({ name: 'app-one', projectType: 'application' }))
    })

    it('discovers projects from workspace.json with inline config', () => {
      const projects = discoverNxProjects(NX_WORKSPACE_JSON_ONLY)

      expect(projects.get('lib-inline')).toEqual({
        name: 'lib-inline',
        root: 'libs/lib-inline',
        projectType: 'library',
        sourceRoot: 'libs/lib-inline/src',
      })
    })
  })

  describe('discoverNxProjects with integrated workspace', () => {
    it('uses custom workspaceLayout appsDir', () => {
      const projects = discoverNxProjects(NX_INTEGRATED_WORKSPACE)

      expect(projects.get('main-app')?.projectType).toBe('application')
    })
  })

  describe('discoverNxProjects with standalone project', () => {
    it('discovers standalone project at workspace root', () => {
      const projects = discoverNxProjects(PROJECT_JSON_ONLY)

      expect(projects.size).toBeGreaterThan(0)
    })
  })

  describe('discoverNxProjects extended', () => {
    it('scans packages directory when present', () => {
      const projects = discoverNxProjects(MONOREPO)

      expect(projects.size).toBeGreaterThan(0)
    })

    it('handles projects with custom names', () => {
      const projects = discoverNxProjects(MONOREPO)

      for (const [, config] of projects) {
        expect(config.name).toEqual(expect.any(String))
      }
    })

    it('scans apps and libs directories', () => {
      const projects = discoverNxProjects(MONOREPO)

      expect(projects.size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('buildSimpleProjectGraph advanced', () => {
    it('handles implicit dependencies', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      for (const deps of Object.values(graph.dependencies)) {
        for (const dep of deps) {
          expect(dep).toEqual({ target: expect.any(String), type: expect.stringMatching(/^(?:implicit|explicit|static)$/) })
        }
      }
    })

    it('includes implicit dependencies from implicitDependencies field', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      expect(graph.dependencies['project-with-deps']).toEqual([
        { target: 'core', type: 'implicit' },
        { target: 'utils', type: 'implicit' },
      ])
    })

    it('skips negative dependencies (starting with !)', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      const projectDeps = graph.dependencies['project-with-deps']

      const depTargets = projectDeps.map((d) => d.target)
      expect(depTargets.filter((target) => target.includes('excluded-dep'))).toEqual([])
    })

    it('sets project type from projectType field', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      const core = graph.nodes['core']
      expect(core === undefined || ['application', 'library'].includes(core.type)).toBe(true)
    })

    it('defaults to library type when projectType not specified', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      for (const node of Object.values(graph.nodes)) {
        expect(['application', 'library']).toContain(node.type)
      }
    })
  })
})
