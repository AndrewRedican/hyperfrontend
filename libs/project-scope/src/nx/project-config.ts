import { join, relative, basename } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists, isDirectory, readDirectory, readJsonFileIfExists } from '../core/fs'
import { createScopedLogger } from '../core/logger'
import { readPackageJsonIfExists } from '../project/package'
import { getNxWorkspaceInfo, isNxProject, NX_PROJECT_FILE } from './detect'

const nxConfigLogger = createScopedLogger('project-scope:nx:config')

/**
 * Object form of an entry in `targets[*].dependsOn`: a target name plus the
 * project(s) it should be looked up in.
 */
export interface NxTargetDependency {
  /** Target name to depend on */
  target: string
  /** Project(s) containing the target */
  projects: string | string[]
}

/**
 * Top-level shape of `workspace.json` consumed by {@link discoverNxProjects}.
 * Only the `projects` map is required; values may be paths or inline configs.
 */
interface NxWorkspaceJson {
  /** Map of project name to configuration path or inline config */
  projects?: Record<string, unknown>
}

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
  dependsOn?: Array<string | NxTargetDependency>
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
 *
 * @example Reading NX project.json
 * ```typescript
 * import { readProjectJson } from '@hyperfrontend/project-scope'
 *
 * const config = readProjectJson('./libs/my-lib')
 * if (config) {
 *   console.log('Project:', config.name, 'Type:', config.projectType)
 * }
 * ```
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
 *
 * @example Getting project configuration
 * ```typescript
 * import { getProjectConfig } from '@hyperfrontend/project-scope'
 *
 * const config = getProjectConfig('./libs/my-lib', '/workspace')
 * // => { name: 'my-lib', root: 'libs/my-lib', projectType: 'library' }
 * ```
 */
export function getProjectConfig(projectPath: string, workspacePath: string): NxProjectConfig | null {
  nxConfigLogger.debug('Getting project config', { projectPath, workspacePath })

  const projectJson = readProjectJson(projectPath)

  if (projectJson) {
    nxConfigLogger.debug('Using project.json config', { projectPath, name: projectJson.name })
    return {
      ...projectJson,
      root: projectJson.root ?? relative(workspacePath, projectPath),
    }
  }

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
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory) {
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
 *
 * @example Discovering all NX projects
 * ```typescript
 * import { discoverNxProjects } from '@hyperfrontend/project-scope'
 *
 * const projects = discoverNxProjects('/workspace')
 * for (const [name, config] of projects) {
 *   console.log(`${name}: ${config.projectType} at ${config.root}`)
 * }
 * ```
 */
export function discoverNxProjects(workspacePath: string): Map<string, NxProjectConfig> {
  const projects = createMap<string, NxProjectConfig>()

  const workspaceJson = readJsonFileIfExists<NxWorkspaceJson>(join(workspacePath, 'workspace.json'))

  if (workspaceJson?.projects) {
    for (const [name, config] of entries(workspaceJson.projects)) {
      if (typeof config === 'string') {
        const projectPath = join(workspacePath, config)
        const projectConfig = getProjectConfig(projectPath, workspacePath)
        if (projectConfig) {
          projects.set(name, { ...projectConfig, name })
        }
      } else if (typeof config === 'object' && config !== null) {
        projects.set(name, { name, ...(<NxProjectConfig>config) })
      }
    }

    return projects
  }

  const workspaceInfo = getNxWorkspaceInfo(workspacePath)
  const appsDir = workspaceInfo?.workspaceLayout.appsDir ?? 'apps'
  const libsDir = workspaceInfo?.workspaceLayout.libsDir ?? 'libs'

  const searchDirs = [appsDir, libsDir]

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
 *
 * @example Building a simple project graph
 * ```typescript
 * import { buildSimpleProjectGraph } from '@hyperfrontend/project-scope'
 *
 * const graph = buildSimpleProjectGraph('/workspace')
 * console.log('Projects:', Object.keys(graph.nodes))
 * console.log('Dependencies:', graph.dependencies['my-app'])
 * ```
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

    if (config.implicitDependencies) {
      for (const dep of config.implicitDependencies) {
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
