import type { DependencyGraph, DependencyNode } from '../../models'
import { join, dirname, relative, resolve } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, isFile, isDirectory, readDirectory, readFileContent } from '../../core/fs'
import { createScopedLogger } from '../../core/logger'
import { readPackageJsonIfExists } from '../../project/package'

const depsLogger = createScopedLogger('project-scope:heuristics:deps')

/**
 * Circular dependency information.
 */
export interface CircularDependency {
  /** Ordered list of files in cycle */
  cycle: string[]
  /** Cycle length */
  length: number
}

/**
 * Project dependencies categorized.
 */
export interface ProjectDependencies {
  /** Production dependencies */
  runtime: string[]
  /** Development dependencies */
  development: string[]
  /** Peer dependencies */
  peer: string[]
  /** Optional dependencies */
  optional: string[]
  /** Total count */
  total: number
}

/**
 * Options for dependency graph building.
 */
export interface BuildGraphOptions {
  /** Maximum depth to traverse */
  maxDepth?: number
  /** Include node_modules imports */
  includeExternal?: boolean
  /** File extensions to analyze */
  extensions?: string[]
}

/**
 * Extract import/require statements from source code.
 *
 * @param content - File content
 * @returns Array of imported module paths
 */
function extractImports(content: string): string[] {
  const imports: string[] = []

  const esImportFromRegex = /import\s+.+?\s+from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = esImportFromRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  const sideEffectImportRegex = /import\s+['"]([^'"]+)['"]/g
  while ((match = sideEffectImportRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  const exportFromRegex = /export\s+.+?\s+from\s+['"]([^'"]+)['"]/g
  while ((match = exportFromRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  return imports
}

/**
 * Resolve import path to actual file path.
 *
 * @param importPath - Import specifier from source code
 * @param fromFile - Absolute path of file containing the import
 * @param projectPath - Project root directory
 * @param extensions - File extensions to check when resolving
 * @returns Resolved relative path or null if external/not found
 */
function resolveImportPath(importPath: string, fromFile: string, projectPath: string, extensions: string[]): string | null {
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null
  }

  const fromDir = dirname(fromFile)
  const absolutePath = resolve(fromDir, importPath)

  if (exists(absolutePath)) {
    if (isFile(absolutePath)) {
      return relative(projectPath, absolutePath)
    }
    if (isDirectory(absolutePath)) {
      for (const ext of extensions) {
        const indexPath = join(absolutePath, `index${ext}`)
        if (exists(indexPath) && isFile(indexPath)) {
          return relative(projectPath, indexPath)
        }
      }
    }
  }

  for (const ext of extensions) {
    const pathWithExt = absolutePath + ext
    if (exists(pathWithExt) && isFile(pathWithExt)) {
      return relative(projectPath, pathWithExt)
    }
  }

  return null
}

/**
 * Collect source files from directory.
 *
 * @param dir - Absolute path of directory to scan
 * @param extensions - File extensions to include (e.g., '.ts')
 * @param maxDepth - Maximum recursion depth for subdirectories
 * @param currentDepth - Current recursion depth (internal use)
 * @returns Array of absolute file paths
 */
function collectSourceFiles(dir: string, extensions: string[], maxDepth: number, currentDepth = 0): string[] {
  if (currentDepth > maxDepth) return []

  const files: string[] = []

  try {
    const entries = readDirectory(dir)

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue
      }

      if (entry.isDirectory) {
        files.push(...collectSourceFiles(fullPath, extensions, maxDepth, currentDepth + 1))
      } else if (entry.isFile) {
        const hasValidExt = extensions.some((ext) => entry.name.endsWith(ext))
        if (hasValidExt) {
          files.push(fullPath)
        }
      }
    }
  } catch {
    // Directory not readable
  }

  return files
}

/**
 * Build dependency graph from source files.
 *
 * Analyzes imports/exports in source files to build a graph of
 * internal dependencies.
 *
 * @param projectPath - Absolute path to project root
 * @param options - Configuration for graph building
 * @returns Dependency graph with nodes, roots, and leaves
 *
 * @example
 * ```typescript
 * import { buildDependencyGraph } from '@hyperfrontend/project-scope'
 *
 * const graph = buildDependencyGraph('./my-lib')
 * console.log('Root files:', graph.roots)   // Files not imported by anything
 * console.log('Leaf files:', graph.leaves)  // Files that don't import anything
 * console.log('Total nodes:', graph.nodes.size)
 *
 * // Examine a specific node's dependencies
 * const node = graph.nodes.get('src/utils/helper.ts')
 * console.log('Depends on:', node?.dependencies)
 * console.log('Used by:', node?.dependents)
 * ```
 */
export function buildDependencyGraph(projectPath: string, options?: BuildGraphOptions): DependencyGraph {
  const extensions = options?.extensions ?? ['.ts', '.tsx', '.js', '.jsx']
  const maxDepth = options?.maxDepth ?? 10
  const includeExternal = options?.includeExternal ?? false

  depsLogger.debug('Building dependency graph', { projectPath, extensions, maxDepth, includeExternal })

  const nodes = createMap<string, DependencyNode>()
  const incomingEdges = createMap<string, Set<string>>()

  const srcDir = join(projectPath, 'src')
  let sourceFiles: string[]

  if (exists(srcDir) && isDirectory(srcDir)) {
    sourceFiles = collectSourceFiles(srcDir, extensions, maxDepth)
    depsLogger.debug('Collected source files from src directory', { count: sourceFiles.length })
  } else {
    sourceFiles = collectSourceFiles(projectPath, extensions, maxDepth)
    depsLogger.debug('Collected source files from project root', { count: sourceFiles.length })
  }

  for (const file of sourceFiles) {
    const relativePath = relative(projectPath, file)
    nodes.set(relativePath, {
      id: relativePath,
      path: relativePath,
      dependencies: [],
      dependents: [],
    })
    incomingEdges.set(relativePath, createSet<string>())
  }

  for (const file of sourceFiles) {
    const relativePath = relative(projectPath, file)
    const node = nodes.get(relativePath)
    if (!node) continue

    try {
      const content = readFileContent(file)
      const imports = extractImports(content)

      for (const importPath of imports) {
        const resolved = resolveImportPath(importPath, file, projectPath, extensions)

        if (resolved && nodes.has(resolved)) {
          if (!node.dependencies.includes(resolved)) {
            node.dependencies.push(resolved)
          }

          const incoming = incomingEdges.get(resolved)
          if (incoming) {
            incoming.add(relativePath)
          }

          const dependentNode = nodes.get(resolved)
          if (dependentNode && !dependentNode.dependents.includes(relativePath)) {
            dependentNode.dependents.push(relativePath)
          }
        } else if (includeExternal && !importPath.startsWith('.')) {
          if (!node.dependencies.includes(importPath)) {
            node.dependencies.push(importPath)
          }
        }
      }
    } catch {
      // File not readable
    }
  }

  const roots: string[] = []
  for (const [path, incoming] of incomingEdges) {
    if (incoming.size === 0) {
      roots.push(path)
    }
  }

  const leaves: string[] = []
  for (const [path, node] of nodes) {
    const hasInternalDeps = node.dependencies.some((dep) => nodes.has(dep))
    if (!hasInternalDeps) {
      leaves.push(path)
    }
  }

  depsLogger.debug('Dependency graph built', {
    nodeCount: nodes.size,
    rootCount: roots.length,
    leafCount: leaves.length,
  })

  return { nodes, roots, leaves }
}

/**
 * Find circular dependencies in graph using DFS.
 *
 * @param graph - Dependency graph
 * @returns Array of circular dependencies found
 */
export function findCircularDependencies(graph: DependencyGraph): CircularDependency[] {
  depsLogger.debug('Searching for circular dependencies', { nodeCount: graph.nodes.size })

  const cycles: CircularDependency[] = []
  const visited = createSet<string>()
  const recursionStack = createSet<string>()
  const path: string[] = []

  /**
   * Depth-first search to detect cycles.
   *
   * @param nodeId - Current node being visited
   */
  function dfs(nodeId: string): void {
    if (recursionStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId)
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart)
        cycle.push(nodeId)

        const normalized = [...cycle].sort().join('|')
        const isDuplicate = cycles.some((c) => [...c.cycle].sort().join('|') === normalized)

        if (!isDuplicate) {
          depsLogger.debug('Found circular dependency', { cycleLength: cycle.length - 1, cycle })
          cycles.push({
            cycle,
            length: cycle.length - 1,
          })
        }
      }
      return
    }

    if (visited.has(nodeId)) {
      return
    }

    const node = graph.nodes.get(nodeId)
    if (!node) return

    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)

    for (const dep of node.dependencies) {
      if (graph.nodes.has(dep)) {
        dfs(dep)
      }
    }

    path.pop()
    recursionStack.delete(nodeId)
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId)
    }
  }

  depsLogger.debug('Circular dependency search complete', { cyclesFound: cycles.length })
  return cycles
}

/**
 * Collect all dependencies from package.json grouped by category.
 *
 * @param projectPath - Project directory
 * @returns Dependencies grouped by runtime, dev, peer, and optional
 */
export function getProjectDependencies(projectPath: string): ProjectDependencies {
  const packageJson = readPackageJsonIfExists(projectPath)

  if (!packageJson) {
    return {
      runtime: [],
      development: [],
      peer: [],
      optional: [],
      total: 0,
    }
  }

  const runtime = packageJson.dependencies ? keys(packageJson.dependencies) : []
  const development = packageJson.devDependencies ? keys(packageJson.devDependencies) : []
  const peer = packageJson.peerDependencies ? keys(packageJson.peerDependencies) : []
  const optional = packageJson.optionalDependencies ? keys(packageJson.optionalDependencies) : []

  const allDeps = createSet([...runtime, ...development, ...peer, ...optional])

  return {
    runtime,
    development,
    peer,
    optional,
    total: allDeps.size,
  }
}
