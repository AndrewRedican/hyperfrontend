/**
 * Workspace types for configuration, projects, and query utilities.
 *
 * @module @hyperfrontend/versioning/workspace/models
 */
export type { Project, CreateProjectOptions } from './project'
export type { Workspace, WorkspaceConfig, WorkspaceType } from './workspace'
export {
  createProject,
  isPublishable,
  isPrivate,
  hasChangelog,
  hasInternalDependencies,
  hasInternalDependents,
  getDependencyCount,
  getDependentCount,
  withDependents,
  addDependent,
} from './project'
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
} from './workspace'
