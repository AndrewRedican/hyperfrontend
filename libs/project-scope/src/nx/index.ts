/**
 * Nx workspace detection, project configuration reading, and devkit utilities.
 *
 * @module @hyperfrontend/project-scope/nx
 */
export type { NxJson, NxWorkspaceInfo, NxWorkspaceLayout } from './detect'
export { findNxWorkspaceRoot, getNxWorkspaceInfo, isNxProject, isNxWorkspace, NX_CONFIG_FILES, NX_PROJECT_FILE } from './detect'
export type { DevkitLoadResult, NxDevkit } from './devkit-loader'
export { getDevkit, isDevkitAvailable, resetDevkitCache, tryLoadDevkit, withDevkit } from './devkit-loader'
export type { NxProjectConfig, NxProjectDependency, NxProjectGraph, NxProjectGraphNode, NxTargetConfig } from './project-config'
export { buildSimpleProjectGraph, discoverNxProjects, getProjectConfig, readProjectJson } from './project-config'
