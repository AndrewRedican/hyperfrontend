import type { Project } from './project'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createProject } from './project'
import {
  createWorkspaceConfig,
  createWorkspace,
  getProject,
  hasProject,
  getProjectNames,
  getProjectCount,
  getDependents,
  getDependencies,
  dependsOn,
  DEFAULT_PATTERNS,
  DEFAULT_EXCLUDE,
  DEFAULT_WORKSPACE_CONFIG,
} from './workspace'

const createTestProject = (name: string) =>
  createProject({
    name,
    version: '1.0.0',
    path: `/workspace/packages/${name}`,
    packageJsonPath: `/workspace/packages/${name}/package.json`,
    packageJson: { name, version: '1.0.0' },
  })

describe('DEFAULT_PATTERNS', () => {
  it('includes common monorepo patterns', () => {
    expect(DEFAULT_PATTERNS).toContain('libs/*/package.json')
    expect(DEFAULT_PATTERNS).toContain('apps/*/package.json')
    expect(DEFAULT_PATTERNS).toContain('packages/*/package.json')
  })
})

describe('DEFAULT_EXCLUDE', () => {
  it('excludes node_modules and dist', () => {
    expect(DEFAULT_EXCLUDE).toContain('**/node_modules/**')
    expect(DEFAULT_EXCLUDE).toContain('**/dist/**')
  })
})

describe('DEFAULT_WORKSPACE_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_WORKSPACE_CONFIG.includeChangelogs).toBe(true)
    expect(DEFAULT_WORKSPACE_CONFIG.trackDependencies).toBe(true)
    expect(DEFAULT_WORKSPACE_CONFIG.patterns).toEqual(DEFAULT_PATTERNS)
    expect(DEFAULT_WORKSPACE_CONFIG.exclude).toEqual(DEFAULT_EXCLUDE)
  })
})

describe('createWorkspaceConfig', () => {
  it('creates config with defaults', () => {
    const config = createWorkspaceConfig()

    expect(config.patterns).toEqual(DEFAULT_PATTERNS)
    expect(config.exclude).toEqual(DEFAULT_EXCLUDE)
    expect(config.includeChangelogs).toBe(true)
    expect(config.trackDependencies).toBe(true)
  })

  it('allows overriding patterns', () => {
    const config = createWorkspaceConfig({
      patterns: ['custom/*/package.json'],
    })

    expect(config.patterns).toEqual(['custom/*/package.json'])
    expect(config.exclude).toEqual(DEFAULT_EXCLUDE)
  })

  it('allows overriding exclude', () => {
    const config = createWorkspaceConfig({
      exclude: ['**/build/**'],
    })

    expect(config.exclude).toEqual(['**/build/**'])
  })

  it('allows overriding includeChangelogs', () => {
    const config = createWorkspaceConfig({
      includeChangelogs: false,
    })

    expect(config.includeChangelogs).toBe(false)
  })

  it('allows overriding trackDependencies', () => {
    const config = createWorkspaceConfig({
      trackDependencies: false,
    })

    expect(config.trackDependencies).toBe(false)
  })
})

describe('createWorkspace', () => {
  it('creates a workspace with projects', () => {
    const projectA = createTestProject('project-a')
    const projectB = createTestProject('project-b')
    const projects = createMap([
      ['project-a', projectA],
      ['project-b', projectB],
    ])

    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects,
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(workspace.root).toBe('/workspace')
    expect(workspace.type).toBe('nx')
    expect(workspace.projects.size).toBe(2)
    expect(workspace.projectList).toHaveLength(2)
  })

  it('sorts projectList alphabetically', () => {
    const projectZ = createTestProject('z-project')
    const projectA = createTestProject('a-project')
    const projectM = createTestProject('m-project')
    const projects = createMap([
      ['z-project', projectZ],
      ['a-project', projectA],
      ['m-project', projectM],
    ])

    const workspace = createWorkspace({
      root: '/workspace',
      type: 'npm',
      projects,
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(workspace.projectList[0].name).toBe('a-project')
    expect(workspace.projectList[1].name).toBe('m-project')
    expect(workspace.projectList[2].name).toBe('z-project')
  })

  it('stores dependency graph', () => {
    const projectA = createTestProject('project-a')
    const projectB = createTestProject('project-b')
    const projects = createMap([
      ['project-a', projectA],
      ['project-b', projectB],
    ])

    const depGraph = createMap([['project-a', ['project-b'] as readonly string[]]])
    const reverseDepGraph = createMap([['project-b', ['project-a'] as readonly string[]]])

    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects,
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: depGraph,
      reverseDependencyGraph: reverseDepGraph,
    })

    expect(workspace.dependencyGraph.get('project-a')).toEqual(['project-b'])
    expect(workspace.reverseDependencyGraph.get('project-b')).toEqual(['project-a'])
  })
})

describe('getProject', () => {
  it('returns project when exists', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['project-a', projectA]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(getProject(workspace, 'project-a')).toBe(projectA)
  })

  it('returns undefined when not exists', () => {
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap<string, Project>(),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(getProject(workspace, 'nonexistent')).toBeUndefined()
  })
})

describe('hasProject', () => {
  it('returns true when project exists', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['project-a', projectA]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(hasProject(workspace, 'project-a')).toBe(true)
  })

  it('returns false when project not exists', () => {
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap<string, Project>(),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(hasProject(workspace, 'nonexistent')).toBe(false)
  })
})

describe('getProjectNames', () => {
  it('returns all project names', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const projectB = createProject({
      name: 'project-b',
      version: '1.0.0',
      path: '/workspace/packages/b',
      packageJsonPath: '/workspace/packages/b/package.json',
      packageJson: { name: 'project-b', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([
        ['project-a', projectA],
        ['project-b', projectB],
      ]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    const names = getProjectNames(workspace)
    expect(names).toContain('project-a')
    expect(names).toContain('project-b')
  })

  it('returns empty array for empty workspace', () => {
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap<string, Project>(),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(getProjectNames(workspace)).toEqual([])
  })
})

describe('getProjectCount', () => {
  it('returns number of projects', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['project-a', projectA]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(getProjectCount(workspace)).toBe(1)
  })

  it('returns zero for empty workspace', () => {
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap<string, Project>(),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(getProjectCount(workspace)).toBe(0)
  })
})

describe('getDependents', () => {
  it('returns dependents from dependency graph', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['project-a', projectA]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap([['project-a', ['project-b', 'project-c'] as readonly string[]]]),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(getDependents(workspace, 'project-a')).toEqual(['project-b', 'project-c'])
  })

  it('returns empty array for project with no dependents', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['project-a', projectA]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(getDependents(workspace, 'project-a')).toEqual([])
  })
})

describe('getDependencies', () => {
  it('returns dependencies from reverse dependency graph', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['project-a', projectA]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap([['project-a', ['lib-utils', 'lib-core'] as readonly string[]]]),
    })

    expect(getDependencies(workspace, 'project-a')).toEqual(['lib-utils', 'lib-core'])
  })

  it('returns empty array for project with no dependencies', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['project-a', projectA]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(getDependencies(workspace, 'project-a')).toEqual([])
  })
})

describe('dependsOn', () => {
  it('returns true when projectA depends on projectB', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const projectB = createProject({
      name: 'project-b',
      version: '1.0.0',
      path: '/workspace/packages/b',
      packageJsonPath: '/workspace/packages/b/package.json',
      packageJson: { name: 'project-b', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([
        ['project-a', projectA],
        ['project-b', projectB],
      ]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap([['project-a', ['project-b'] as readonly string[]]]),
    })

    expect(dependsOn(workspace, 'project-a', 'project-b')).toBe(true)
  })

  it('returns false when projectA does not depend on projectB', () => {
    const projectA = createProject({
      name: 'project-a',
      version: '1.0.0',
      path: '/workspace/packages/a',
      packageJsonPath: '/workspace/packages/a/package.json',
      packageJson: { name: 'project-a', version: '1.0.0' },
    })
    const projectB = createProject({
      name: 'project-b',
      version: '1.0.0',
      path: '/workspace/packages/b',
      packageJsonPath: '/workspace/packages/b/package.json',
      packageJson: { name: 'project-b', version: '1.0.0' },
    })
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([
        ['project-a', projectA],
        ['project-b', projectB],
      ]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap<string, readonly string[]>(),
    })

    expect(dependsOn(workspace, 'project-a', 'project-b')).toBe(false)
  })
})
