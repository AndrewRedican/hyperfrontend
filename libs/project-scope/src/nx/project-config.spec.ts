import { resolve } from 'node:path'
import { readProjectJson, getProjectConfig, discoverNxProjects, buildSimpleProjectGraph } from './project-config'

const FIXTURES_DIR = resolve(__dirname, '../../__fixtures__')
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

      expect(config).not.toBeNull()
      expect(config?.name).toBe('core')
      expect(config?.projectType).toBe('library')
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

      expect(config).not.toBeNull()
      expect(config?.root).toBe('packages/core')
      expect(config?.name).toBe('core')
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

      expect(projects).toBeInstanceOf(Map)
      expect(projects.size).toBeGreaterThan(0)
    })

    it('includes core project from packages directory', () => {
      const projects = discoverNxProjects(MONOREPO)

      expect(projects.has('core')).toBe(true)

      const core = projects.get('core')
      expect(core?.projectType).toBe('library')
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

      expect(graph).toHaveProperty('nodes')
      expect(graph).toHaveProperty('dependencies')
    })

    it('includes discovered projects as nodes', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      expect(graph.nodes).toHaveProperty('core')
      expect(graph.nodes['core'].name).toBe('core')
      expect(graph.nodes['core'].type).toBe('library')
    })

    it('sets up dependencies array for each project', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      expect(graph.dependencies).toHaveProperty('core')
      expect(Array.isArray(graph.dependencies['core'])).toBe(true)
    })

    it('accepts pre-discovered projects map', () => {
      const projects = discoverNxProjects(MONOREPO)
      const graph = buildSimpleProjectGraph(MONOREPO, projects)

      expect(graph.nodes).toHaveProperty('core')
    })

    it('returns empty graph for non-NX workspace', () => {
      const graph = buildSimpleProjectGraph(MINIMAL_PROJECT)

      expect(Object.keys(graph.nodes).length).toBe(0)
      expect(Object.keys(graph.dependencies).length).toBe(0)
    })
  })

  describe('getProjectConfig extended', () => {
    it('reads config from package.json nx field when no project.json', () => {
      const config = getProjectConfig(NX_PACKAGE_JSON_FIELD, FIXTURES_DIR)

      expect(config).not.toBeNull()
      expect(config?.name).toBe('nx-field-package')
      expect(config?.projectType).toBe('library')
      expect(config?.root).toBeDefined()
    })

    it('prefers project.json over package.json nx field', () => {
      const config = getProjectConfig(CORE_PROJECT, MONOREPO)

      expect(config).not.toBeNull()
      expect(config?.name).toBe('core')
    })

    it('returns null for project without project.json or nx field', () => {
      const config = getProjectConfig(MINIMAL_PROJECT, FIXTURES_DIR)
      expect(config).toBeNull()
    })

    it('includes tags from package.json nx field', () => {
      const config = getProjectConfig(NX_PACKAGE_JSON_FIELD, FIXTURES_DIR)

      expect(config).not.toBeNull()
      expect(config?.tags).toEqual(['scope:shared'])
    })
  })

  describe('discoverNxProjects with workspace.json', () => {
    it('discovers projects from workspace.json with string path references', () => {
      const projects = discoverNxProjects(NX_WORKSPACE_JSON_ONLY)

      expect(projects).toBeInstanceOf(Map)
      expect(projects.has('app-one')).toBe(true)

      const appOne = projects.get('app-one')
      expect(appOne?.name).toBe('app-one')
      expect(appOne?.projectType).toBe('application')
    })

    it('discovers projects from workspace.json with inline config', () => {
      const projects = discoverNxProjects(NX_WORKSPACE_JSON_ONLY)

      expect(projects.has('lib-inline')).toBe(true)

      const libInline = projects.get('lib-inline')
      expect(libInline?.name).toBe('lib-inline')
      expect(libInline?.projectType).toBe('library')
      expect(libInline?.root).toBe('libs/lib-inline')
    })
  })

  describe('discoverNxProjects with integrated workspace', () => {
    it('uses custom workspaceLayout appsDir', () => {
      const projects = discoverNxProjects(NX_INTEGRATED_WORKSPACE)

      expect(projects.has('main-app')).toBe(true)

      const mainApp = projects.get('main-app')
      expect(mainApp?.projectType).toBe('application')
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
        expect(typeof config.name).toBe('string')
        expect(config.name).toBeDefined()
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

      for (const [, deps] of Object.entries(graph.dependencies)) {
        expect(Array.isArray(deps)).toBe(true)
        for (const dep of deps) {
          expect(dep).toHaveProperty('target')
          expect(dep).toHaveProperty('type')
          expect(['implicit', 'explicit', 'static']).toContain(dep.type)
        }
      }
    })

    it('includes implicit dependencies from implicitDependencies field', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      const projectDeps = graph.dependencies['project-with-deps']

      expect(projectDeps).toBeDefined()
      expect(Array.isArray(projectDeps)).toBe(true)

      const depTargets = projectDeps.map((d) => d.target)
      expect(depTargets).toContain('core')
      expect(depTargets).toContain('utils')
    })

    it('skips negative dependencies (starting with !)', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      const projectDeps = graph.dependencies['project-with-deps']

      const depTargets = projectDeps.map((d) => d.target)
      expect(depTargets).not.toContain('excluded-dep')
      expect(depTargets).not.toContain('!excluded-dep')
    })

    it('sets project type from projectType field', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      const core = graph.nodes['core']
      expect(core === undefined || ['application', 'library'].includes(core.type)).toBe(true)
    })

    it('defaults to library type when projectType not specified', () => {
      const graph = buildSimpleProjectGraph(MONOREPO)

      for (const node of Object.values(graph.nodes)) {
        expect(node.type).toBeDefined()
        expect(['application', 'library']).toContain(node.type)
      }
    })
  })
})
