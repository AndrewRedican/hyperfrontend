import type { PackageJson } from '@hyperfrontend/project-scope/project/package'
import type { Project } from '../models/project'
import type { Workspace } from '../models/workspace'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProject } from '../models/project'
import { createWorkspace, DEFAULT_WORKSPACE_CONFIG } from '../models/workspace'
import {
  findInternalDependencies,
  findInternalDependenciesWithTypes,
  buildDependencyGraph,
  getTopologicalOrder,
  getTransitiveDependents,
  getTransitiveDependencies,
} from './dependencies'

function createTestProject(
  name: string,
  version = '1.0.0',
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {},
  peerDeps: Record<string, string> = {},
  optDeps: Record<string, string> = {}
): Project {
  return createProject({
    name,
    version,
    path: `/workspace/packages/${name}`,
    packageJsonPath: `/workspace/packages/${name}/package.json`,
    packageJson: {
      name,
      version,
      dependencies: deps,
      devDependencies: devDeps,
      peerDependencies: peerDeps,
      optionalDependencies: optDeps,
    },
  })
}

function createTestWorkspace(projects: Project[], depGraph?: Map<string, readonly string[]>): Workspace {
  const projectMap = createMap(projects.map((p) => [p.name, p] as [string, Project]))
  const dependencyGraph = depGraph ?? createMap<string, readonly string[]>()
  const reverseGraph = createMap<string, readonly string[]>()

  for (const [pkg, dependents] of dependencyGraph) {
    for (const dep of dependents) {
      const existing = reverseGraph.get(dep) ?? []
      reverseGraph.set(dep, [...existing, pkg])
    }
  }

  return createWorkspace({
    root: '/workspace',
    type: 'nx',
    projects: projectMap,
    config: DEFAULT_WORKSPACE_CONFIG,
    dependencyGraph,
    reverseDependencyGraph: reverseGraph,
  })
}

describe('findInternalDependencies', () => {
  it('finds production dependencies', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      version: '1.0.0',
      dependencies: {
        '@scope/lib-a': '^1.0.0',
        '@scope/lib-b': '^1.0.0',
        lodash: '^4.0.0',
      },
    }
    const allPackages = createSet(['@scope/lib-a', '@scope/lib-b', '@scope/lib-c'])

    const internal = findInternalDependencies(packageJson, allPackages)

    expect(internal).toContain('@scope/lib-a')
    expect(internal).toContain('@scope/lib-b')
    expect(internal).not.toContain('lodash')
  })

  it('finds dev dependencies', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      version: '1.0.0',
      devDependencies: {
        '@scope/testing': '^1.0.0',
      },
    }
    const allPackages = createSet(['@scope/testing'])

    const internal = findInternalDependencies(packageJson, allPackages)

    expect(internal).toContain('@scope/testing')
  })

  it('finds peer dependencies', () => {
    const packageJson: PackageJson = {
      name: 'my-lib',
      version: '1.0.0',
      peerDependencies: {
        '@scope/core': '^1.0.0',
      },
    }
    const allPackages = createSet(['@scope/core'])

    const internal = findInternalDependencies(packageJson, allPackages)

    expect(internal).toContain('@scope/core')
  })

  it('finds optional dependencies', () => {
    const packageJson: PackageJson = {
      name: 'my-lib',
      version: '1.0.0',
      optionalDependencies: {
        '@scope/optional': '^1.0.0',
      },
    }
    const allPackages = createSet(['@scope/optional'])

    const internal = findInternalDependencies(packageJson, allPackages)

    expect(internal).toContain('@scope/optional')
  })

  it('returns empty array when no internal dependencies', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      version: '1.0.0',
      dependencies: {
        lodash: '^4.0.0',
      },
    }
    const allPackages = createSet(['@scope/lib-a'])

    const internal = findInternalDependencies(packageJson, allPackages)

    expect(internal).toEqual([])
  })

  it('handles missing dependency sections', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      version: '1.0.0',
    }
    const allPackages = createSet(['@scope/lib-a'])

    const internal = findInternalDependencies(packageJson, allPackages)

    expect(internal).toEqual([])
  })
})

describe('findInternalDependenciesWithTypes', () => {
  it('returns edges with type information', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      version: '1.0.0',
      dependencies: {
        '@scope/lib-a': '^1.0.0',
      },
      devDependencies: {
        '@scope/testing': '^2.0.0',
      },
    }
    const allPackages = createSet(['@scope/lib-a', '@scope/testing'])

    const edges = findInternalDependenciesWithTypes('my-app', packageJson, allPackages)

    expect(edges).toHaveLength(2)

    const depEdge = edges.find((e) => e.to === '@scope/lib-a')
    expect(depEdge).toBeDefined()
    expect(depEdge?.type).toBe('dependencies')
    expect(depEdge?.from).toBe('my-app')
    expect(depEdge?.versionRange).toBe('^1.0.0')

    const devEdge = edges.find((e) => e.to === '@scope/testing')
    expect(devEdge).toBeDefined()
    expect(devEdge?.type).toBe('devDependencies')
    expect(devEdge?.versionRange).toBe('^2.0.0')
  })

  it('includes peer dependencies', () => {
    const packageJson: PackageJson = {
      name: 'my-lib',
      version: '1.0.0',
      peerDependencies: {
        '@scope/core': '>=1.0.0',
      },
    }
    const allPackages = createSet(['@scope/core'])

    const edges = findInternalDependenciesWithTypes('my-lib', packageJson, allPackages)

    expect(edges).toEqual([expect.objectContaining({ type: 'peerDependencies' })])
  })

  it('includes optional dependencies', () => {
    const packageJson: PackageJson = {
      name: 'my-lib',
      version: '1.0.0',
      optionalDependencies: {
        '@scope/optional': '^1.0.0',
      },
    }
    const allPackages = createSet(['@scope/optional'])

    const edges = findInternalDependenciesWithTypes('my-lib', packageJson, allPackages)

    expect(edges).toEqual([expect.objectContaining({ type: 'optionalDependencies' })])
  })

  it('returns empty array when no internal dependencies', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      version: '1.0.0',
    }
    const allPackages = createSet(['@scope/lib-a'])

    const edges = findInternalDependenciesWithTypes('my-app', packageJson, allPackages)

    expect(edges).toEqual([])
  })
})

describe('buildDependencyGraph', () => {
  it('builds graph for linear dependencies', () => {
    const projects = [
      createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' }),
      createTestProject('lib-a', '1.0.0', { 'lib-b': '^1.0.0' }),
      createTestProject('lib-b', '1.0.0'),
    ]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.dependencyGraph.get('lib-b')).toContain('lib-a')
    expect(analysis.dependencyGraph.get('lib-a')).toContain('app')
    expect(analysis.dependencyGraph.get('app')).toEqual([])

    expect(analysis.reverseDependencyGraph.get('app')).toContain('lib-a')
    expect(analysis.reverseDependencyGraph.get('lib-a')).toContain('lib-b')
    expect(analysis.reverseDependencyGraph.get('lib-b')).toEqual([])
  })

  it('identifies leaf packages (no dependents)', () => {
    const projects = [createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' }), createTestProject('lib-a', '1.0.0')]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.leafPackages).toContain('app')
    expect(analysis.leafPackages).not.toContain('lib-a')
  })

  it('identifies root packages (no dependencies)', () => {
    const projects = [createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' }), createTestProject('lib-a', '1.0.0')]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.rootPackages).toContain('lib-a')
    expect(analysis.rootPackages).not.toContain('app')
  })

  it('detects circular dependencies', () => {
    const projects = [
      createTestProject('lib-a', '1.0.0', { 'lib-b': '^1.0.0' }),
      createTestProject('lib-b', '1.0.0', { 'lib-a': '^1.0.0' }),
    ]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.hasCircularDependencies).toBe(true)
    expect(analysis.circularDependencies.length).toBeGreaterThan(0)
  })

  it('handles packages with no dependencies', () => {
    const projects = [createTestProject('standalone', '1.0.0')]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.rootPackages).toContain('standalone')
    expect(analysis.leafPackages).toContain('standalone')
    expect(analysis.hasCircularDependencies).toBe(false)
  })

  it('collects all edges', () => {
    const projects = [
      createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' }, { 'lib-b': '^1.0.0' }),
      createTestProject('lib-a', '1.0.0'),
      createTestProject('lib-b', '1.0.0'),
    ]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.edges).toHaveLength(2)

    const prodEdge = analysis.edges.find((e) => e.to === 'lib-a')
    expect(prodEdge?.type).toBe('dependencies')

    const devEdge = analysis.edges.find((e) => e.to === 'lib-b')
    expect(devEdge?.type).toBe('devDependencies')
  })

  it('handles complex dependency graph', () => {
    const projects = [
      createTestProject('app-1', '1.0.0', { 'lib-shared': '^1.0.0', 'lib-a': '^1.0.0' }),
      createTestProject('app-2', '1.0.0', { 'lib-shared': '^1.0.0', 'lib-b': '^1.0.0' }),
      createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' }),
      createTestProject('lib-b', '1.0.0', { 'lib-core': '^1.0.0' }),
      createTestProject('lib-shared', '1.0.0', { 'lib-core': '^1.0.0' }),
      createTestProject('lib-core', '1.0.0'),
    ]

    const analysis = buildDependencyGraph(projects)

    const coreDependents = analysis.dependencyGraph.get('lib-core') ?? []
    expect(coreDependents).toContain('lib-a')
    expect(coreDependents).toContain('lib-b')
    expect(coreDependents).toContain('lib-shared')

    expect(analysis.rootPackages).toContain('lib-core')
    expect(analysis.leafPackages).toContain('app-1')
    expect(analysis.leafPackages).toContain('app-2')
  })

  it('detects multiple separate cycles in a graph', () => {
    const projects = [
      createTestProject('lib-a', '1.0.0', { 'lib-b': '^1.0.0', 'lib-e': '^1.0.0' }),
      createTestProject('lib-b', '1.0.0', { 'lib-c': '^1.0.0' }),
      createTestProject('lib-c', '1.0.0', { 'lib-d': '^1.0.0' }),
      createTestProject('lib-d', '1.0.0', { 'lib-b': '^1.0.0' }),
      createTestProject('lib-e', '1.0.0', { 'lib-f': '^1.0.0' }),
      createTestProject('lib-f', '1.0.0', { 'lib-e': '^1.0.0' }),
    ]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.hasCircularDependencies).toBe(true)
    expect(analysis.circularDependencies.length).toBeGreaterThanOrEqual(1)
  })

  it('correctly builds dependency graph with missing package references', () => {
    const projects = [
      createTestProject('app', '1.0.0', { 'external-lib': '^1.0.0', 'lib-a': '^1.0.0' }),
      createTestProject('lib-a', '1.0.0'),
    ]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.dependencyGraph.has('external-lib')).toBe(false)
    expect(analysis.dependencyGraph.get('lib-a')).toContain('app')
  })

  it('handles single package with self-reference (edge case)', () => {
    const projects = [createTestProject('lib-a', '1.0.0', { 'lib-a': '^1.0.0' })]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.hasCircularDependencies).toBe(true)
  })

  it('processes complex diamond with multiple path cycles', () => {
    const projects = [
      createTestProject('lib-a', '1.0.0', { 'lib-b': '^1.0.0', 'lib-c': '^1.0.0' }),
      createTestProject('lib-b', '1.0.0', { 'lib-d': '^1.0.0' }),
      createTestProject('lib-c', '1.0.0', { 'lib-d': '^1.0.0' }),
      createTestProject('lib-d', '1.0.0', { 'lib-a': '^1.0.0' }),
    ]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.hasCircularDependencies).toBe(true)
    const dependentsOfD = analysis.dependencyGraph.get('lib-d') ?? []
    expect(dependentsOfD).toContain('lib-b')
    expect(dependentsOfD).toContain('lib-c')
  })
})

describe('getTopologicalOrder', () => {
  it('returns packages in build order', () => {
    const projects = [
      createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' }),
      createTestProject('lib-a', '1.0.0', { 'lib-b': '^1.0.0' }),
      createTestProject('lib-b', '1.0.0'),
    ]

    const analysis = buildDependencyGraph(projects)
    const order = getTopologicalOrder(analysis)

    const libBIndex = order.indexOf('lib-b')
    const libAIndex = order.indexOf('lib-a')
    const appIndex = order.indexOf('app')

    expect(libBIndex).toBeLessThan(libAIndex)
    expect(libAIndex).toBeLessThan(appIndex)
  })

  it('throws on circular dependencies', () => {
    const projects = [
      createTestProject('lib-a', '1.0.0', { 'lib-b': '^1.0.0' }),
      createTestProject('lib-b', '1.0.0', { 'lib-a': '^1.0.0' }),
    ]

    const analysis = buildDependencyGraph(projects)

    expect(() => getTopologicalOrder(analysis)).toThrow(/[Cc]ircular/)
  })

  it('handles independent packages', () => {
    const projects = [createTestProject('pkg-a', '1.0.0'), createTestProject('pkg-b', '1.0.0'), createTestProject('pkg-c', '1.0.0')]

    const analysis = buildDependencyGraph(projects)
    const order = getTopologicalOrder(analysis)

    expect(order).toHaveLength(3)
    expect(order).toContain('pkg-a')
    expect(order).toContain('pkg-b')
    expect(order).toContain('pkg-c')
  })

  it('orders multiple independent root packages', () => {
    const projects = [
      createTestProject('root-a', '1.0.0'),
      createTestProject('root-b', '1.0.0'),
      createTestProject('app', '1.0.0', { 'root-a': '^1.0.0', 'root-b': '^1.0.0' }),
    ]

    const analysis = buildDependencyGraph(projects)
    const order = getTopologicalOrder(analysis)

    expect(order).toHaveLength(3)
    expect(order.indexOf('app')).toBeGreaterThan(order.indexOf('root-a'))
    expect(order.indexOf('app')).toBeGreaterThan(order.indexOf('root-b'))
  })

  it('handles empty package list', () => {
    const analysis = buildDependencyGraph([])
    const order = getTopologicalOrder(analysis)

    expect(order).toEqual([])
  })
})

describe('getTransitiveDependents', () => {
  it('returns all transitive dependents', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })
    const app = createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' })

    const depGraph = createMap([
      ['lib-core', ['lib-a'] as readonly string[]],
      ['lib-a', ['app'] as readonly string[]],
      ['app', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libCore, libA, app], depGraph)

    const dependents = getTransitiveDependents(workspace, 'lib-core')

    expect(dependents.has('lib-a')).toBe(true)
    expect(dependents.has('app')).toBe(true)
    expect(dependents.has('lib-core')).toBe(false)
  })

  it('returns empty set for leaf packages', () => {
    const app = createTestProject('app', '1.0.0')
    const workspace = createTestWorkspace([app], createMap([['app', [] as readonly string[]]]))

    const dependents = getTransitiveDependents(workspace, 'app')

    expect(dependents.size).toBe(0)
  })

  it('handles diamond dependencies', () => {
    const core = createTestProject('core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0')
    const libB = createTestProject('lib-b', '1.0.0')
    const app = createTestProject('app', '1.0.0')

    const depGraph = createMap([
      ['core', ['lib-a', 'lib-b'] as readonly string[]],
      ['lib-a', ['app'] as readonly string[]],
      ['lib-b', ['app'] as readonly string[]],
      ['app', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([core, libA, libB, app], depGraph)

    const dependents = getTransitiveDependents(workspace, 'core')

    expect(dependents.has('lib-a')).toBe(true)
    expect(dependents.has('lib-b')).toBe(true)
    expect(dependents.has('app')).toBe(true)
  })

  it('returns empty set for unknown package', () => {
    const app = createTestProject('app', '1.0.0')
    const workspace = createTestWorkspace([app], createMap([['app', [] as readonly string[]]]))

    const dependents = getTransitiveDependents(workspace, 'nonexistent')

    expect(dependents.size).toBe(0)
  })
})

describe('getTransitiveDependencies', () => {
  it('returns all transitive dependencies', () => {
    const libCore = createTestProject('lib-core', '1.0.0')
    const libA = createTestProject('lib-a', '1.0.0', { 'lib-core': '^1.0.0' })
    const app = createTestProject('app', '1.0.0', { 'lib-a': '^1.0.0' })

    const reverseDepGraph = createMap([
      ['app', ['lib-a'] as readonly string[]],
      ['lib-a', ['lib-core'] as readonly string[]],
      ['lib-core', [] as readonly string[]],
    ])

    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([
        ['lib-core', libCore],
        ['lib-a', libA],
        ['app', app],
      ]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: reverseDepGraph,
    })

    const deps = getTransitiveDependencies(workspace, 'app')

    expect(deps.has('lib-a')).toBe(true)
    expect(deps.has('lib-core')).toBe(true)
    expect(deps.has('app')).toBe(false)
  })

  it('returns empty set for root packages', () => {
    const libCore = createTestProject('lib-core', '1.0.0')

    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['lib-core', libCore]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap([['lib-core', [] as readonly string[]]]),
    })

    const deps = getTransitiveDependencies(workspace, 'lib-core')

    expect(deps.size).toBe(0)
  })

  it('returns empty set for unknown package', () => {
    const app = createTestProject('app', '1.0.0')
    const workspace = createWorkspace({
      root: '/workspace',
      type: 'nx',
      projects: createMap([['app', app]]),
      config: DEFAULT_WORKSPACE_CONFIG,
      dependencyGraph: createMap<string, readonly string[]>(),
      reverseDependencyGraph: createMap([['app', [] as readonly string[]]]),
    })

    const deps = getTransitiveDependencies(workspace, 'nonexistent')

    expect(deps.size).toBe(0)
  })
})

describe('edge cases', () => {
  it('handles graph with packages not in the project list', () => {
    const projects = [createTestProject('app', '1.0.0', { 'missing-lib': '^1.0.0' })]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.rootPackages).toContain('app')
    expect(analysis.leafPackages).toContain('app')
  })

  it('handles large linear dependency chain', () => {
    const projects = []
    for (let i = 0; i < 10; i++) {
      const deps = i > 0 ? { [`pkg-${i - 1}`]: '^1.0.0' } : {}
      projects.push(createTestProject(`pkg-${i}`, '1.0.0', deps))
    }

    const analysis = buildDependencyGraph(projects)
    const order = getTopologicalOrder(analysis)

    expect(order).toHaveLength(10)
    expect(order[0]).toBe('pkg-0')
    expect(order[9]).toBe('pkg-9')
  })

  it('handles workspace with empty dependency graph entries', () => {
    const libA = createTestProject('lib-a', '1.0.0')
    const libB = createTestProject('lib-b', '1.0.0')

    const depGraph = createMap([
      ['lib-a', [] as readonly string[]],
      ['lib-b', [] as readonly string[]],
    ])

    const workspace = createTestWorkspace([libA, libB], depGraph)

    const dependentsA = getTransitiveDependents(workspace, 'lib-a')
    const dependentsB = getTransitiveDependents(workspace, 'lib-b')

    expect(dependentsA.size).toBe(0)
    expect(dependentsB.size).toBe(0)
  })

  it('correctly processes cycle detection with deep nesting', () => {
    const projects = [
      createTestProject('pkg-a', '1.0.0', { 'pkg-b': '^1.0.0' }),
      createTestProject('pkg-b', '1.0.0', { 'pkg-c': '^1.0.0' }),
      createTestProject('pkg-c', '1.0.0', { 'pkg-d': '^1.0.0' }),
      createTestProject('pkg-d', '1.0.0', { 'pkg-e': '^1.0.0' }),
      createTestProject('pkg-e', '1.0.0', { 'pkg-a': '^1.0.0' }),
    ]

    const analysis = buildDependencyGraph(projects)

    expect(analysis.hasCircularDependencies).toBe(true)
    expect(analysis.circularDependencies.length).toBeGreaterThan(0)
  })

  it('handles adjacency list missing entry during topological sort', () => {
    const projects = [createTestProject('standalone', '1.0.0')]
    const analysis = buildDependencyGraph(projects)

    const order = getTopologicalOrder(analysis)
    expect(order).toHaveLength(1)
    expect(order[0]).toBe('standalone')
  })
})
