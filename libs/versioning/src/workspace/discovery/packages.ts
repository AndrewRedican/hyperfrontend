/* eslint-disable @nx/enforce-module-boundaries */
import type { PackageJson, Tree } from '@hyperfrontend/project-scope'
import type { Project, CreateProjectOptions } from '../models/project'
import type { WorkspaceConfig } from '../models/workspace'
import { dirname, join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readPackageJson } from '@hyperfrontend/project-scope/project/package'
import { findWorkspaceRoot } from '@hyperfrontend/project-scope/project/root'
import { findFiles, findFilesInTree } from '@hyperfrontend/project-scope/project/traversal'
import { createProject } from '../models/project'
import { DEFAULT_WORKSPACE_CONFIG } from '../models/workspace'
import { findInternalDependencies } from './dependencies'
import { findChangelogs, findChangelogsInTree } from './discover-changelogs'

/**
 * Options for package discovery.
 */
export interface DiscoveryOptions {
  /** Workspace root (auto-detected if not provided) */
  workspaceRoot?: string

  /** Glob patterns for finding package.json files */
  patterns?: readonly string[]

  /** Patterns to exclude */
  exclude?: readonly string[]

  /** Include changelogs in discovery */
  includeChangelogs?: boolean

  /** Track internal dependencies */
  trackDependencies?: boolean

  /** Optional VFS tree for VFS-aware discovery */
  tree?: Tree
}

/**
 * Result of package discovery.
 */
export interface DiscoveryResult {
  /** All discovered projects */
  readonly projects: readonly Project[]

  /** Projects indexed by name */
  readonly projectMap: ReadonlyMap<string, Project>

  /** All discovered package names */
  readonly packageNames: ReadonlySet<string>

  /** Workspace root path */
  readonly workspaceRoot: string

  /** Configuration used for discovery */
  readonly config: WorkspaceConfig
}

/**
 * Raw discovered package before dependency analysis.
 */
interface RawPackageInfo {
  /** Package name from package.json */
  name: string
  /** Package version string */
  version: string
  /** Absolute path to the package directory */
  path: string
  /** Absolute path to the package.json file */
  packageJsonPath: string
  /** Parsed contents of package.json */
  packageJson: PackageJson
  /** Path to CHANGELOG.md or null if not found */
  changelogPath: string | null
}

/**
 * Discovers all packages within a workspace.
 * Finds package.json files, parses them, and optionally discovers
 * changelogs and internal dependencies.
 *
 * @param options - Discovery options
 * @returns Discovery result with all found packages
 * @throws {Error} If workspace root cannot be found
 *
 * @example
 * ```typescript
 * import { discoverPackages } from '@hyperfrontend/versioning'
 *
 * // Discover all packages in current workspace
 * const result = discoverPackages()
 *
 * // Discover with custom patterns
 * const result = discoverPackages({
 *   patterns: ['packages/*\/package.json'],
 *   includeChangelogs: true
 * })
 *
 * // Access discovered projects
 * for (const project of result.projects) {
 *   console.log(`${project.name}@${project.version}`)
 * }
 * ```
 */
export function discoverPackages(options: DiscoveryOptions = {}): DiscoveryResult {
  const { tree } = options

  const workspaceRoot = options.workspaceRoot ?? (tree ? tree.root : findWorkspaceRoot(process.cwd()))
  if (!workspaceRoot) {
    throw createError('Could not find workspace root. Ensure you are in a monorepo with nx.json, turbo.json, or workspaces field.')
  }

  const config: WorkspaceConfig = {
    patterns: options.patterns ?? DEFAULT_WORKSPACE_CONFIG.patterns,
    exclude: options.exclude ?? DEFAULT_WORKSPACE_CONFIG.exclude,
    includeChangelogs: options.includeChangelogs ?? DEFAULT_WORKSPACE_CONFIG.includeChangelogs,
    trackDependencies: options.trackDependencies ?? DEFAULT_WORKSPACE_CONFIG.trackDependencies,
  }

  const packageJsonPaths = tree ? findPackageJsonFilesInTree(tree, config) : findPackageJsonFiles(workspaceRoot, config)

  const rawPackages = tree
    ? parsePackageJsonFilesFromTree(tree, workspaceRoot, packageJsonPaths)
    : parsePackageJsonFiles(workspaceRoot, packageJsonPaths)

  const packageNames = createSet(rawPackages.map((p) => p.name))

  const changelogMap = config.includeChangelogs
    ? tree
      ? findChangelogsInTree(tree, rawPackages)
      : findChangelogs(workspaceRoot, rawPackages)
    : createMap<string, string>()

  const rawWithChangelogs = rawPackages.map((pkg) => ({
    ...pkg,
    changelogPath: changelogMap.get(pkg.path) ?? null,
  }))

  const projects = config.trackDependencies
    ? buildProjectsWithDependencies(rawWithChangelogs, packageNames)
    : rawWithChangelogs.map((pkg) => createProject(pkg))

  const projectMap = createMap<string, Project>()
  for (const project of projects) {
    projectMap.set(project.name, project)
  }

  return {
    projects,
    projectMap,
    packageNames,
    workspaceRoot,
    config,
  }
}

/**
 * Finds all package.json files matching the configured patterns.
 *
 * @param workspaceRoot - Root directory to search from
 * @param config - Workspace configuration
 * @returns Array of relative paths to package.json files
 */
function findPackageJsonFiles(workspaceRoot: string, config: WorkspaceConfig): string[] {
  const patterns = [...config.patterns]
  const excludePatterns = [...config.exclude]

  return findFiles(workspaceRoot, patterns, {
    ignorePatterns: excludePatterns,
  })
}

/**
 * Parses package.json files and extracts metadata.
 *
 * @param workspaceRoot - Workspace root path
 * @param packageJsonPaths - Relative paths to package.json files
 * @returns Array of raw package info objects
 */
function parsePackageJsonFiles(workspaceRoot: string, packageJsonPaths: string[]): RawPackageInfo[] {
  const packages: RawPackageInfo[] = []

  for (const relativePath of packageJsonPaths) {
    const absolutePath = join(workspaceRoot, relativePath)
    const projectPath = dirname(absolutePath)

    try {
      const packageJson = readPackageJson(absolutePath)

      if (!packageJson.name) {
        continue
      }

      packages.push({
        name: packageJson.name,
        version: packageJson.version ?? '0.0.0',
        path: projectPath,
        packageJsonPath: absolutePath,
        packageJson,
        changelogPath: null,
      })
    } catch {
      continue
    }
  }

  return packages
}

/**
 * Finds all package.json files in a VFS tree matching the configured patterns.
 *
 * @param tree - VFS tree instance
 * @param config - Workspace configuration
 * @returns Array of relative paths to package.json files
 */
function findPackageJsonFilesInTree(tree: Tree, config: WorkspaceConfig): string[] {
  const patterns = [...config.patterns]
  const excludePatterns = [...config.exclude]

  return findFilesInTree(tree, patterns, {
    ignorePatterns: excludePatterns,
  })
}

/**
 * Parses package.json files from a VFS tree and extracts metadata.
 *
 * @param tree - VFS tree instance
 * @param workspaceRoot - Workspace root path
 * @param packageJsonPaths - Relative paths to package.json files
 * @returns Array of raw package info objects
 */
function parsePackageJsonFilesFromTree(tree: Tree, workspaceRoot: string, packageJsonPaths: string[]): RawPackageInfo[] {
  const packages: RawPackageInfo[] = []

  for (const relativePath of packageJsonPaths) {
    const absolutePath = join(workspaceRoot, relativePath)
    const projectPath = dirname(absolutePath)

    try {
      const content = tree.read(relativePath, 'utf-8')
      if (!content) {
        continue
      }

      const packageJson = <PackageJson>parse(content)

      if (!packageJson.name) {
        continue
      }

      packages.push({
        name: packageJson.name,
        version: packageJson.version ?? '0.0.0',
        path: projectPath,
        packageJsonPath: absolutePath,
        packageJson,
        changelogPath: null,
      })
    } catch {
      continue
    }
  }

  return packages
}

/**
 * Builds projects with internal dependency information.
 *
 * @param rawPackages - Raw package info objects
 * @param packageNames - Set of all package names
 * @returns Array of Project objects with dependencies populated
 */
function buildProjectsWithDependencies(rawPackages: RawPackageInfo[], packageNames: Set<string>): Project[] {
  const projectsWithDeps: Array<
    CreateProjectOptions & {
      /** List of internal package dependencies */
      internalDependencies: string[]
    }
  > = []

  for (const pkg of rawPackages) {
    const internalDeps = findInternalDependencies(pkg.packageJson, packageNames)
    projectsWithDeps.push({
      ...pkg,
      internalDependencies: internalDeps,
    })
  }

  const dependentsMap = createMap<string, string[]>()
  for (const pkg of projectsWithDeps) {
    for (const dep of pkg.internalDependencies) {
      const existing = dependentsMap.get(dep) ?? []
      existing.push(pkg.name)
      dependentsMap.set(dep, existing)
    }
  }

  return projectsWithDeps.map((pkg) => {
    const dependents = dependentsMap.get(pkg.name) ?? []
    return createProject({
      ...pkg,
      internalDependents: dependents,
    })
  })
}

/**
 * Discovers a single project by path.
 *
 * @param projectPath - Path to project directory or package.json
 * @returns The discovered project or null if not found
 *
 * @example
 * ```typescript
 * import { discoverProject } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/utils')
 * if (project) {
 *   console.log(`Found ${project.name}@${project.version}`)
 * }
 *
 * // Also accepts direct package.json path
 * const project2 = discoverProject('./libs/utils/package.json')
 * ```
 */
export function discoverProject(projectPath: string): Project | null {
  const packageJsonPath = projectPath.endsWith('package.json') ? projectPath : join(projectPath, 'package.json')
  const projectDir = projectPath.endsWith('package.json') ? dirname(projectPath) : projectPath

  try {
    const packageJson = readPackageJson(packageJsonPath)

    if (!packageJson.name) {
      return null
    }

    return createProject({
      name: packageJson.name,
      version: packageJson.version ?? '0.0.0',
      path: projectDir,
      packageJsonPath,
      packageJson,
      changelogPath: null,
    })
  } catch {
    return null
  }
}

/**
 * Discovers a project by name within a workspace.
 *
 * @param projectName - Name of the project to find
 * @param options - Discovery options
 * @returns The project or null if not found
 *
 * @example
 * ```typescript
 * import { discoverProjectByName } from '@hyperfrontend/versioning'
 *
 * const project = discoverProjectByName('@myorg/utils')
 * if (project) {
 *   console.log(`Found at ${project.path}`)
 * }
 *
 * // With custom workspace root
 * const project2 = discoverProjectByName('@myorg/core', { workspaceRoot: '/custom/path' })
 * ```
 */
export function discoverProjectByName(projectName: string, options: DiscoveryOptions = {}): Project | null {
  const result = discoverPackages(options)
  return result.projectMap.get(projectName) ?? null
}
