/**
 * Workspace Module
 *
 * Package discovery, dependency management, and versioning coordination
 * for monorepo workspaces. Integrates with project-scope for file operations.
 *
 * @example
 * ```typescript
 * import { discoverPackages, calculateCascadeBumps, applyBumps } from '@hyperfrontend/versioning'
 *
 * // Discover workspace packages
 * const { projects, projectMap, workspaceRoot } = discoverPackages()
 *
 * // Calculate cascade bumps for a package update
 * const cascadeResult = calculateCascadeBumps(workspace, [
 *   { name: 'lib-utils', bumpType: 'minor' }
 * ])
 *
 * // Apply the bumps
 * const updateResult = applyBumps(workspace, cascadeResult.bumps)
 * ```
 */

import type { DiscoveryOptions } from './discovery/packages'
import type { Project } from './models/project'
import type { Workspace, WorkspaceType } from './models/workspace'
import { join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { exists, readPackageJsonIfExists } from '@hyperfrontend/project-scope'
import { buildDependencyGraph } from './discovery/dependencies'
import { discoverPackages } from './discovery/packages'
import { createWorkspace } from './models/workspace'

export {
  DEFAULT_PATTERNS,
  DEFAULT_EXCLUDE,
  DEFAULT_WORKSPACE_CONFIG,
  createWorkspaceConfig,
  createWorkspace,
  getProject,
  hasProject,
  getProjectNames,
  getProjectCount,
  getDependents,
  getDependencies,
  dependsOn,
  createProject,
  isPublishable,
  isPrivate,
  hasChangelog as hasProjectChangelog,
  hasInternalDependencies,
  hasInternalDependents,
  getDependencyCount,
  getDependentCount,
  withDependents,
  addDependent,
} from './models'
export type { Workspace, WorkspaceConfig, WorkspaceType, Project, CreateProjectOptions } from './models'
export * from './discovery'
export * from './operations'

/**
 * Detects the workspace type based on configuration markers.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Detected workspace type (nx, turbo, lerna, pnpm, yarn, npm, rush, or unknown)
 */
function detectWorkspaceType(workspaceRoot: string): WorkspaceType {
  if (exists(join(workspaceRoot, 'nx.json'))) return 'nx'
  if (exists(join(workspaceRoot, 'turbo.json'))) return 'turbo'
  if (exists(join(workspaceRoot, 'lerna.json'))) return 'lerna'
  if (exists(join(workspaceRoot, 'pnpm-workspace.yaml'))) return 'pnpm'
  if (exists(join(workspaceRoot, 'rush.json'))) return 'rush'

  const rootPkg = readPackageJsonIfExists(join(workspaceRoot, 'package.json'))
  if (rootPkg?.workspaces) return 'yarn'

  return 'npm'
}

/**
 * Creates a complete workspace object by discovering packages
 * and building the dependency graph.
 *
 * @param options - Discovery configuration options
 * @returns Complete workspace object with projects and dependency graph
 *
 * @example Create a complete workspace object from disk
 * ```typescript
 * import { createWorkspaceFromDisk } from '@hyperfrontend/versioning'
 *
 * const workspace = createWorkspaceFromDisk()
 *
 * // Access projects
 * for (const project of workspace.projectList) {
 *   console.log(`${project.name}@${project.version}`)
 * }
 *
 * // Get dependents of a package
 * const dependents = workspace.dependencyGraph.get('lib-utils')
 * ```
 */
export function createWorkspaceFromDisk(options: DiscoveryOptions = {}): Workspace {
  const discovery = discoverPackages(options)
  const analysis = buildDependencyGraph(discovery.projects)
  const workspaceType = detectWorkspaceType(discovery.workspaceRoot)

  const projectMap = createMap<string, Project>()
  for (const project of discovery.projects) {
    projectMap.set(project.name, project)
  }

  return createWorkspace({
    root: discovery.workspaceRoot,
    type: workspaceType,
    projects: projectMap,
    config: discovery.config,
    dependencyGraph: analysis.dependencyGraph,
    reverseDependencyGraph: analysis.reverseDependencyGraph,
  })
}
