/**
 * Nx workspace detection and project configuration reading.
 *
 * @module @hyperfrontend/project-scope/nx
 */
export type { NxJson, NxWorkspaceInfo, NxWorkspaceLayout } from './detect'
export type { NxProjectConfig, NxProjectDependency, NxProjectGraph, NxProjectGraphNode, NxTargetConfig } from './project-config'
export { findNxWorkspaceRoot, getNxWorkspaceInfo, isNxProject, isNxWorkspace, NX_CONFIG_FILES, NX_PROJECT_FILE } from './detect'
export { buildSimpleProjectGraph, discoverNxProjects, getProjectConfig, readProjectJson } from './project-config'
