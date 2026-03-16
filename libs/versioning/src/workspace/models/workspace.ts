/**
 * Workspace Model
 *
 * Represents a monorepo workspace with multiple projects.
 * Used for package discovery, dependency tracking, and coordinated versioning.
 */

import type { Project } from './project'

/**
 * Workspace configuration options.
 */
export interface WorkspaceConfig {
  /** Glob patterns for finding packages */
  readonly patterns: readonly string[]

  /** Patterns to exclude from discovery */
  readonly exclude: readonly string[]

  /** Whether to include changelog paths in discovery */
  readonly includeChangelogs: boolean

  /** Whether to track internal dependencies */
  readonly trackDependencies: boolean
}

/**
 * Workspace type indicating the package manager / tool in use.
 */
export type WorkspaceType = 'nx' | 'turbo' | 'lerna' | 'pnpm' | 'npm' | 'yarn' | 'rush' | 'unknown'

/**
 * Complete workspace representation.
 * Contains all discovered projects and their relationships.
 */
export interface Workspace {
  /** Absolute path to workspace root */
  readonly root: string

  /** Detected workspace type */
  readonly type: WorkspaceType

  /** All discovered projects indexed by name */
  readonly projects: ReadonlyMap<string, Project>

  /** Projects ordered by name */
  readonly projectList: readonly Project[]

  /** Configuration used for discovery */
  readonly config: WorkspaceConfig

  /** Dependency graph (project name -> dependents) */
  readonly dependencyGraph: ReadonlyMap<string, readonly string[]>

  /** Reverse dependency graph (project name -> dependencies) */
  readonly reverseDependencyGraph: ReadonlyMap<string, readonly string[]>
}

/**
 * Default workspace discovery patterns.
 */
export const DEFAULT_PATTERNS: readonly string[] = [
  'libs/*/package.json',
  'apps/*/package.json',
  'packages/*/package.json',
  'tools/*/package.json',
  'plugins/*/package.json',
]

/**
 * Default exclusion patterns.
 */
export const DEFAULT_EXCLUDE: readonly string[] = ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**']

/**
 * Default workspace configuration.
 */
export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  patterns: DEFAULT_PATTERNS,
  exclude: DEFAULT_EXCLUDE,
  includeChangelogs: true,
  trackDependencies: true,
}

/**
 * Creates a new workspace configuration by merging with defaults.
 *
 * @param options - Partial configuration options
 * @returns Complete workspace configuration
 */
export function createWorkspaceConfig(options?: Partial<WorkspaceConfig>): WorkspaceConfig {
  return {
    patterns: options?.patterns ?? DEFAULT_PATTERNS,
    exclude: options?.exclude ?? DEFAULT_EXCLUDE,
    includeChangelogs: options?.includeChangelogs ?? true,
    trackDependencies: options?.trackDependencies ?? true,
  }
}

/**
 * Creates a new workspace object.
 *
 * @param options - Workspace properties
 * @param options.root - Absolute path to workspace root directory
 * @param options.type - Type of workspace (nx, turbo, etc.)
 * @param options.projects - Map of project names to project objects
 * @param options.config - Configuration used for workspace discovery
 * @param options.dependencyGraph - Map of package names to their dependents
 * @param options.reverseDependencyGraph - Map of package names to their dependencies
 * @returns A new Workspace object
 */
export function createWorkspace(options: {
  root: string
  type: WorkspaceType
  projects: ReadonlyMap<string, Project>
  config: WorkspaceConfig
  dependencyGraph: ReadonlyMap<string, readonly string[]>
  reverseDependencyGraph: ReadonlyMap<string, readonly string[]>
}): Workspace {
  const projectList = [...options.projects.values()].sort((a, b) => a.name.localeCompare(b.name))

  return {
    root: options.root,
    type: options.type,
    projects: options.projects,
    projectList,
    config: options.config,
    dependencyGraph: options.dependencyGraph,
    reverseDependencyGraph: options.reverseDependencyGraph,
  }
}

/**
 * Gets a project by name from the workspace.
 *
 * @param workspace - Workspace to search in
 * @param projectName - Identifier of the project to retrieve
 * @returns The project or undefined if not found
 */
export function getProject(workspace: Workspace, projectName: string): Project | undefined {
  return workspace.projects.get(projectName)
}

/**
 * Checks if a project exists in the workspace.
 *
 * @param workspace - Workspace to search in
 * @param projectName - Identifier of the project to check
 * @returns True if the project exists
 */
export function hasProject(workspace: Workspace, projectName: string): boolean {
  return workspace.projects.has(projectName)
}

/**
 * Gets all project names in the workspace.
 *
 * @param workspace - Workspace to retrieve project names from
 * @returns Array of project names
 */
export function getProjectNames(workspace: Workspace): readonly string[] {
  return workspace.projectList.map((p) => p.name)
}

/**
 * Gets the count of projects in the workspace.
 *
 * @param workspace - Workspace to count projects in
 * @returns Number of projects
 */
export function getProjectCount(workspace: Workspace): number {
  return workspace.projects.size
}

/**
 * Gets projects that depend on the given project.
 *
 * @param workspace - Workspace containing the dependency graph
 * @param projectName - Name of the dependency
 * @returns Array of dependent project names
 */
export function getDependents(workspace: Workspace, projectName: string): readonly string[] {
  return workspace.dependencyGraph.get(projectName) ?? []
}

/**
 * Gets projects that the given project depends on.
 *
 * @param workspace - Workspace containing the dependency graph
 * @param projectName - Identifier of the project to look up
 * @returns Array of dependency project names
 */
export function getDependencies(workspace: Workspace, projectName: string): readonly string[] {
  return workspace.reverseDependencyGraph.get(projectName) ?? []
}

/**
 * Checks if projectA depends on projectB.
 *
 * @param workspace - Workspace containing the dependency graph
 * @param projectA - Name of the potentially dependent project
 * @param projectB - Name of the potential dependency
 * @returns True if projectA depends on projectB
 */
export function dependsOn(workspace: Workspace, projectA: string, projectB: string): boolean {
  const deps = getDependencies(workspace, projectA)
  return deps.includes(projectB)
}
