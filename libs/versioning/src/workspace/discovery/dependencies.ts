/**
 * Dependency Graph
 *
 * Builds and analyzes dependency relationships between workspace projects.
 * Provides functions for traversing the dependency graph and determining
 * build/release order.
 */

import type { PackageJson } from '@hyperfrontend/project-scope/project/package'
import type { Project } from '../models/project'
import type { Workspace } from '../models/workspace'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Dependency graph structure.
 * Maps package name to list of packages that depend on it.
 */
export type DependencyGraph = ReadonlyMap<string, readonly string[]>

/**
 * Dependency relation type.
 */
export type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'

/**
 * A single dependency edge in the graph.
 */
export interface DependencyEdge {
  /** Package that has the dependency */
  readonly from: string

  /** Package being depended on */
  readonly to: string

  /** Type of dependency relationship */
  readonly type: DependencyType

  /** Version range specified */
  readonly versionRange: string
}

/**
 * Result of dependency graph analysis.
 */
export interface DependencyGraphAnalysis {
  /** Forward graph: package -> dependents */
  readonly dependencyGraph: DependencyGraph

  /** Reverse graph: package -> dependencies */
  readonly reverseDependencyGraph: DependencyGraph

  /** All dependency edges */
  readonly edges: readonly DependencyEdge[]

  /** Packages with no dependents (leaf nodes) */
  readonly leafPackages: readonly string[]

  /** Packages with no dependencies (root nodes) */
  readonly rootPackages: readonly string[]

  /** Whether the graph has circular dependencies */
  readonly hasCircularDependencies: boolean

  /** Detected circular dependency chains */
  readonly circularDependencies: readonly string[][]
}

/**
 * Finds internal dependencies in a package.json.
 * Returns names of workspace packages that this package depends on.
 *
 * @param packageJson - Parsed package.json content
 * @param workspacePackageNames - Set of all package names in the workspace
 * @returns Array of internal dependency names
 *
 * @example
 * ```typescript
 * const internalDeps = findInternalDependencies(packageJson, allPackageNames)
 * // ['@scope/lib-a', '@scope/lib-b']
 * ```
 */
export function findInternalDependencies(packageJson: PackageJson, workspacePackageNames: Set<string>): string[] {
  const internal: string[] = []

  const allDeps: Record<string, string> = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  }

  for (const depName of keys(allDeps)) {
    if (workspacePackageNames.has(depName)) {
      internal.push(depName)
    }
  }

  return internal
}

/**
 * Finds internal dependencies with type information.
 *
 * @param packageName - Name of the package being analyzed
 * @param packageJson - Parsed package.json content
 * @param workspacePackageNames - Set of all package names in the workspace
 * @returns Array of dependency edges with type information
 */
export function findInternalDependenciesWithTypes(
  packageName: string,
  packageJson: PackageJson,
  workspacePackageNames: Set<string>
): DependencyEdge[] {
  const edges: DependencyEdge[] = []

  const depTypes: DependencyType[] = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

  for (const depType of depTypes) {
    const deps = packageJson[depType]
    if (deps) {
      for (const [depName, versionRange] of entries(deps)) {
        if (workspacePackageNames.has(depName)) {
          edges.push({
            from: packageName,
            to: depName,
            type: depType,
            versionRange,
          })
        }
      }
    }
  }

  return edges
}

/**
 * Builds a complete dependency graph from a list of projects.
 *
 * @param projects - List of projects to analyze
 * @returns Dependency graph analysis result
 *
 * @example
 * ```typescript
 * import { buildDependencyGraph, discoverPackages } from '@hyperfrontend/versioning'
 *
 * const { projects } = discoverPackages()
 * const analysis = buildDependencyGraph(projects)
 *
 * // Get packages that depend on 'lib-utils'
 * const dependents = analysis.dependencyGraph.get('lib-utils') ?? []
 *
 * // Get packages in topological order for building
 * const buildOrder = getTopologicalOrder(analysis)
 * ```
 */
export function buildDependencyGraph(projects: readonly Project[]): DependencyGraphAnalysis {
  const packageNames = createSet(projects.map((p) => p.name))
  const edges: DependencyEdge[] = []

  // Collect all edges
  for (const project of projects) {
    const projectEdges = findInternalDependenciesWithTypes(project.name, project.packageJson, packageNames)
    edges.push(...projectEdges)
  }

  // Build forward graph (dependency -> dependents)
  const dependencyGraph = createMap<string, string[]>()
  for (const name of packageNames) {
    dependencyGraph.set(name, [])
  }
  for (const edge of edges) {
    const dependents = dependencyGraph.get(edge.to)
    if (dependents) {
      dependents.push(edge.from)
    }
  }

  // Build reverse graph (package -> dependencies)
  const reverseDependencyGraph = createMap<string, string[]>()
  for (const name of packageNames) {
    reverseDependencyGraph.set(name, [])
  }
  for (const edge of edges) {
    const deps = reverseDependencyGraph.get(edge.from)
    if (deps) {
      deps.push(edge.to)
    }
  }

  // Find leaf packages (no dependents)
  const leafPackages: string[] = []
  for (const [name, dependents] of dependencyGraph) {
    if (dependents.length === 0) {
      leafPackages.push(name)
    }
  }

  // Find root packages (no dependencies)
  const rootPackages: string[] = []
  for (const [name, deps] of reverseDependencyGraph) {
    if (deps.length === 0) {
      rootPackages.push(name)
    }
  }

  // Detect circular dependencies
  const { hasCircular, cycles } = detectCircularDependencies(reverseDependencyGraph)

  // Convert to readonly maps
  const readonlyDependencyGraph = createMap<string, readonly string[]>()
  for (const [key, value] of dependencyGraph) {
    readonlyDependencyGraph.set(key, [...value])
  }

  const readonlyReverseDependencyGraph = createMap<string, readonly string[]>()
  for (const [key, value] of reverseDependencyGraph) {
    readonlyReverseDependencyGraph.set(key, [...value])
  }

  return {
    dependencyGraph: readonlyDependencyGraph,
    reverseDependencyGraph: readonlyReverseDependencyGraph,
    edges,
    leafPackages,
    rootPackages,
    hasCircularDependencies: hasCircular,
    circularDependencies: cycles,
  }
}

/**
 * Detects circular dependencies in the graph using DFS.
 *
 * @param reverseDependencyGraph - Map of package to its dependencies
 * @returns Detection result with cycle information
 */
function detectCircularDependencies(reverseDependencyGraph: Map<string, string[]>): {
  hasCircular: boolean
  cycles: string[][]
} {
  const cycles: string[][] = []
  const visited = createSet<string>()
  const recursionStack = createSet<string>()
  const path: string[] = []

  /**
   * Depth-first search to detect cycles.
   *
   * @param node - Current node being visited
   * @returns True if a cycle was found
   */
  function dfs(node: string): boolean {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const deps = reverseDependencyGraph.get(node) ?? []
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (dfs(dep)) {
          return true
        }
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        const cycleStart = path.indexOf(dep)
        const cycle = path.slice(cycleStart)
        cycle.push(dep) // Close the cycle
        cycles.push(cycle)
      }
    }

    path.pop()
    recursionStack.delete(node)
    return false
  }

  for (const node of reverseDependencyGraph.keys()) {
    if (!visited.has(node)) {
      dfs(node)
    }
  }

  return {
    hasCircular: cycles.length > 0,
    cycles,
  }
}

/**
 * Gets a topological ordering of packages for building.
 * Packages with no dependencies come first.
 *
 * @param analysis - Dependency graph analysis result
 * @returns Array of package names in build order
 * @throws {Error} If circular dependencies exist
 *
 * @example
 * ```typescript
 * const buildOrder = getTopologicalOrder(analysis)
 * for (const pkg of buildOrder) {
 *   await build(pkg)
 * }
 * ```
 */
export function getTopologicalOrder(analysis: DependencyGraphAnalysis): readonly string[] {
  if (analysis.hasCircularDependencies) {
    throw createError(`Circular dependencies detected: ${analysis.circularDependencies.map((c) => c.join(' -> ')).join(', ')}`)
  }

  const result: string[] = []
  const inDegree = createMap<string, number>()
  const adjacency = createMap<string, string[]>()

  // Initialize
  for (const [name, deps] of analysis.reverseDependencyGraph) {
    inDegree.set(name, deps.length)
    adjacency.set(name, [])
  }

  // Build adjacency list (dependency -> dependents)
  for (const [name, deps] of analysis.reverseDependencyGraph) {
    for (const dep of deps) {
      const adj = adjacency.get(dep)
      if (adj) {
        adj.push(name)
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [...analysis.rootPackages]

  while (queue.length > 0) {
    const node = queue.shift()
    if (node === undefined) {
      break
    }
    result.push(node)

    const dependents = adjacency.get(node) ?? []
    for (const dependent of dependents) {
      const degree = inDegree.get(dependent) ?? 0
      inDegree.set(dependent, degree - 1)
      if (degree - 1 === 0) {
        queue.push(dependent)
      }
    }
  }

  return result
}

/**
 * Gets all transitive dependents of a package (direct and indirect).
 *
 * @param workspace - The workspace containing projects
 * @param packageName - Name of the package to analyze
 * @returns Set of all packages that depend on this package
 *
 * @example
 * ```typescript
 * // If lib-a depends on lib-utils and app-main depends on lib-a
 * // Then getTransitiveDependents('lib-utils') returns ['lib-a', 'app-main']
 * ```
 */
export function getTransitiveDependents(workspace: Workspace, packageName: string): Set<string> {
  const dependents = createSet<string>()
  const queue = [packageName]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) {
      break
    }
    const directDependents = workspace.dependencyGraph.get(current) ?? []

    for (const dep of directDependents) {
      if (!dependents.has(dep)) {
        dependents.add(dep)
        queue.push(dep)
      }
    }
  }

  return dependents
}

/**
 * Gets all transitive dependencies of a package (direct and indirect).
 *
 * @param workspace - The workspace containing projects
 * @param packageName - Name of the package to analyze
 * @returns Set of all packages this package depends on
 */
export function getTransitiveDependencies(workspace: Workspace, packageName: string): Set<string> {
  const dependencies = createSet<string>()
  const queue = [packageName]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) {
      break
    }
    const directDeps = workspace.reverseDependencyGraph.get(current) ?? []

    for (const dep of directDeps) {
      if (!dependencies.has(dep)) {
        dependencies.add(dep)
        queue.push(dep)
      }
    }
  }

  return dependencies
}

/**
 * Checks if package A transitively depends on package B.
 *
 * @param workspace - The workspace containing projects
 * @param packageA - Name of the potentially dependent package
 * @param packageB - Name of the potential dependency
 * @returns True if packageA transitively depends on packageB
 */
export function transitivelyDependsOn(workspace: Workspace, packageA: string, packageB: string): boolean {
  const deps = getTransitiveDependencies(workspace, packageA)
  return deps.has(packageB)
}
