/**
 * Dependency graph building and circular dependency detection for project analysis.
 *
 * @module @hyperfrontend/project-scope/heuristics/dependencies
 */
export type { BuildGraphOptions, CircularDependency, ProjectDependencies } from './analyze'
export { buildDependencyGraph, findCircularDependencies, getProjectDependencies } from './analyze'
