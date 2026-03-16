/**
 * Package Discovery
 *
 * Discovers packages within a workspace by finding package.json files
 * and extracting relevant metadata. Uses project-scope for file operations.
 */

import type { PackageJson } from '@hyperfrontend/project-scope'
import type { Project, CreateProjectOptions } from '../models/project'
import type { WorkspaceConfig } from '../models/workspace'
import { dirname, join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { findFiles, readPackageJson, findWorkspaceRoot } from '@hyperfrontend/project-scope'
import { createProject } from '../models/project'
import { DEFAULT_WORKSPACE_CONFIG } from '../models/workspace'
import { findInternalDependencies } from './dependencies'
import { findChangelogs } from './discover-changelogs'

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
  name: string
  version: string
  path: string
  packageJsonPath: string
  packageJson: PackageJson
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
  // Resolve workspace root
  const workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot(process.cwd())
  if (!workspaceRoot) {
    throw createError('Could not find workspace root. Ensure you are in a monorepo with nx.json, turbo.json, or workspaces field.')
  }

  // Build configuration
  const config: WorkspaceConfig = {
    patterns: options.patterns ?? DEFAULT_WORKSPACE_CONFIG.patterns,
    exclude: options.exclude ?? DEFAULT_WORKSPACE_CONFIG.exclude,
    includeChangelogs: options.includeChangelogs ?? DEFAULT_WORKSPACE_CONFIG.includeChangelogs,
    trackDependencies: options.trackDependencies ?? DEFAULT_WORKSPACE_CONFIG.trackDependencies,
  }

  // Find all package.json files
  const packageJsonPaths = findPackageJsonFiles(workspaceRoot, config)

  // Parse package.json files
  const rawPackages = parsePackageJsonFiles(workspaceRoot, packageJsonPaths)

  // Collect all package names for internal dependency detection
  const packageNames = createSet(rawPackages.map((p) => p.name))

  // Find changelogs if requested
  const changelogMap = config.includeChangelogs ? findChangelogs(workspaceRoot, rawPackages) : createMap<string, string>()

  // Build projects with changelog paths
  const rawWithChangelogs = rawPackages.map((pkg) => ({
    ...pkg,
    changelogPath: changelogMap.get(pkg.path) ?? null,
  }))

  // Calculate internal dependencies
  const projects = config.trackDependencies
    ? buildProjectsWithDependencies(rawWithChangelogs, packageNames)
    : rawWithChangelogs.map((pkg) => createProject(pkg))

  // Build project map
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

      // Skip packages without a name
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
      // Skip packages that can't be parsed
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
  // First pass: create projects with dependencies
  const projectsWithDeps: Array<CreateProjectOptions & { internalDependencies: string[] }> = []

  for (const pkg of rawPackages) {
    const internalDeps = findInternalDependencies(pkg.packageJson, packageNames)
    projectsWithDeps.push({
      ...pkg,
      internalDependencies: internalDeps,
    })
  }

  // Build dependency -> dependents map
  const dependentsMap = createMap<string, string[]>()
  for (const pkg of projectsWithDeps) {
    for (const dep of pkg.internalDependencies) {
      const existing = dependentsMap.get(dep) ?? []
      existing.push(pkg.name)
      dependentsMap.set(dep, existing)
    }
  }

  // Second pass: add dependents to each project
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
 */
export function discoverProjectByName(projectName: string, options: DiscoveryOptions = {}): Project | null {
  const result = discoverPackages(options)
  return result.projectMap.get(projectName) ?? null
}
