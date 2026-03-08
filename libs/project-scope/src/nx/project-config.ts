import { join, relative, basename } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists, isDirectory, readDirectory, readJsonFileIfExists } from '../core/fs'
import { createScopedLogger } from '../core/logger'
import { readPackageJsonIfExists } from '../project/package'
import { getNxWorkspaceInfo, isNxProject, NX_PROJECT_FILE } from './detect'

const nxConfigLogger = createScopedLogger('project-scope:nx:config')

/**
 * NX target configuration.
 */
export interface NxTargetConfig {
  /** Executor to run */
  executor?: string
  /** Target outputs */
  outputs?: string[]
  /** Target options */
  options?: Record<string, unknown>
  /** Target configurations */
  configurations?: Record<string, Record<string, unknown>>
  /** Default configuration */
  defaultConfiguration?: string
  /** Depends on other targets */
  dependsOn?: Array<string | { target: string; projects: string | string[] }>
  /** Target inputs for caching */
  inputs?: unknown[]
}

/**
 * NX project configuration from project.json.
 */
export interface NxProjectConfig {
  /** Project name */
  name?: string
  /** Project root path (relative to workspace root) */
  root?: string
  /** Source root path */
  sourceRoot?: string
  /** Project type */
  projectType?: 'application' | 'library'
  /** Project tags for filtering */
  tags?: string[]
  /** Implicit dependencies */
  implicitDependencies?: string[]
  /** Named inputs for caching */
  namedInputs?: Record<string, unknown[]>
  /** Build targets */
  targets?: Record<string, NxTargetConfig>
  /** Generator defaults */
  generators?: Record<string, unknown>
  /** Additional properties */
  [key: string]: unknown
}

/**
 * Simplified project graph node.
 */
export interface NxProjectGraphNode {
  /** Project name */
  name: string
  /** Project type */
  type: string
  /** Project configuration */
  data: NxProjectConfig
}

/**
 * Simplified project dependency.
 */
export interface NxProjectDependency {
  /** Target project name */
  target: string
  /** Dependency type */
  type: 'implicit' | 'explicit' | 'static'
}

/**
 * Simplified project graph.
 */
export interface NxProjectGraph {
  /** Project nodes */
  nodes: Record<string, NxProjectGraphNode>
  /** Project dependencies */
  dependencies: Record<string, NxProjectDependency[]>
}

/**
 * Read project.json for an NX project.
 *
 * @param projectPath - Project directory path
 * @returns Parsed project.json or null if not found
 */
export function readProjectJson(projectPath: string): NxProjectConfig | null {
  const projectJsonPath = join(projectPath, NX_PROJECT_FILE)
  nxConfigLogger.debug('Reading project.json', { path: projectJsonPath })
  const result = readJsonFileIfExists<NxProjectConfig>(projectJsonPath)
  if (result) {
    nxConfigLogger.debug('Project.json loaded', { path: projectJsonPath, name: result.name })
  } else {
    nxConfigLogger.debug('Project.json not found', { path: projectJsonPath })
  }
  return result
}

/**
 * Get project configuration from project.json or package.json nx field.
 *
 * @param projectPath - Project directory path
 * @param workspacePath - Workspace root path (for relative path calculation)
 * @returns Project configuration or null if not found
 */
export function getProjectConfig(projectPath: string, workspacePath: string): NxProjectConfig | null {
  nxConfigLogger.debug('Getting project config', { projectPath, workspacePath })

  // Try project.json first
  const projectJson = readProjectJson(projectPath)

  if (projectJson) {
    nxConfigLogger.debug('Using project.json config', { projectPath, name: projectJson.name })
    return {
      ...projectJson,
      root: projectJson.root ?? relative(workspacePath, projectPath),
    }
  }

  // Try to infer from package.json nx field
  const packageJson = readPackageJsonIfExists(projectPath)

  if (packageJson && typeof packageJson['nx'] === 'object') {
    nxConfigLogger.debug('Using package.json nx field', { projectPath, name: packageJson.name })
    const nxConfig = <Record<string, unknown>>packageJson['nx']
    return {
      name: packageJson.name,
      root: relative(workspacePath, projectPath),
      ...nxConfig,
    }
  }

  nxConfigLogger.debug('No project config found', { projectPath })
  return null
}

/**
 * Recursively scan directory for project.json files.
 *
 * @param dirPath - Directory to scan
 * @param workspacePath - Workspace root path
 * @param projects - Map to add discovered projects to
 * @param maxDepth - Maximum recursion depth
 * @param currentDepth - Current recursion depth
 */
function scanForProjects(
  dirPath: string,
  workspacePath: string,
  projects: Map<string, NxProjectConfig>,
  maxDepth: number,
  currentDepth = 0
): void {
  if (currentDepth > maxDepth) return

  try {
    const entries = readDirectory(dirPath)

    for (const entry of entries) {
      // Skip node_modules and hidden directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory) {
        // Check if this directory is an NX project
        if (isNxProject(fullPath)) {
          const config = getProjectConfig(fullPath, workspacePath)
          if (config) {
            const name = config.name || relative(workspacePath, fullPath).replace(/[\\/]/g, '-')
            projects.set(name, {
              ...config,
              name,
              root: relative(workspacePath, fullPath),
            })
          }
        }

        // Recursively scan subdirectories
        scanForProjects(fullPath, workspacePath, projects, maxDepth, currentDepth + 1)
      }
    }
  } catch {
    // Directory not readable, skip
  }
}

/**
 * Discover all NX projects in workspace.
 * Supports both workspace.json (older format) and project.json (newer format).
 *
 * @param workspacePath - Workspace root path
 * @returns Map of project name to configuration
 */
export function discoverNxProjects(workspacePath: string): Map<string, NxProjectConfig> {
  const projects = createMap<string, NxProjectConfig>()

  // Check for workspace.json (older NX format)
  const workspaceJson = readJsonFileIfExists<{ projects?: Record<string, unknown> }>(join(workspacePath, 'workspace.json'))

  if (workspaceJson?.projects) {
    for (const [name, config] of entries(workspaceJson.projects)) {
      if (typeof config === 'string') {
        // Path reference to project directory
        const projectPath = join(workspacePath, config)
        const projectConfig = getProjectConfig(projectPath, workspacePath)
        if (projectConfig) {
          projects.set(name, { ...projectConfig, name })
        }
      } else if (typeof config === 'object' && config !== null) {
        // Inline config
        projects.set(name, { name, ...(<NxProjectConfig>config) })
      }
    }

    return projects
  }

  // Scan for project.json files (newer NX format)
  const workspaceInfo = getNxWorkspaceInfo(workspacePath)
  const appsDir = workspaceInfo?.workspaceLayout.appsDir ?? 'apps'
  const libsDir = workspaceInfo?.workspaceLayout.libsDir ?? 'libs'

  const searchDirs = [appsDir, libsDir]

  // Also check packages directory (common in some setups)
  if (exists(join(workspacePath, 'packages'))) {
    searchDirs.push('packages')
  }

  for (const dir of searchDirs) {
    const dirPath = join(workspacePath, dir)

    if (exists(dirPath) && isDirectory(dirPath)) {
      try {
        scanForProjects(dirPath, workspacePath, projects, 3)
      } catch {
        // Directory not accessible
      }
    }
  }

  // Also check root-level projects (standalone projects in monorepo root)
  if (isNxProject(workspacePath)) {
    const config = readProjectJson(workspacePath)
    if (config) {
      const name = config.name || basename(workspacePath)
      projects.set(name, {
        ...config,
        name,
        root: '.',
      })
    }
  }

  return projects
}

/**
 * Build a simple project graph from discovered projects.
 * For full graph capabilities, use `@nx/devkit`.
 *
 * @param workspacePath - Workspace root path
 * @param projects - Existing configuration map to skip auto-discovery
 * @returns NxProjectGraph with nodes and dependencies
 */
export function buildSimpleProjectGraph(workspacePath: string, projects?: Map<string, NxProjectConfig>): NxProjectGraph {
  const projectMap = projects ?? discoverNxProjects(workspacePath)

  const nodes: Record<string, NxProjectGraphNode> = {}
  const dependencies: Record<string, NxProjectDependency[]> = {}

  for (const [name, config] of projectMap) {
    nodes[name] = {
      name,
      type: config.projectType ?? 'library',
      data: config,
    }

    dependencies[name] = []

    // Add implicit dependencies
    if (config.implicitDependencies) {
      for (const dep of config.implicitDependencies) {
        // Skip negative dependencies (those starting with !)
        if (!dep.startsWith('!')) {
          dependencies[name].push({
            target: dep,
            type: 'implicit',
          })
        }
      }
    }
  }

  return { nodes, dependencies }
}
