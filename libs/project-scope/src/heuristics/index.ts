/**
 * Project heuristics for type detection, framework identification, entry points, and dependency analysis.
 *
 * @module @hyperfrontend/project-scope/heuristics
 */
export type { BuildGraphOptions, CircularDependency, ProjectDependencies } from './dependencies'
export type { DiscoverEntryPointsOptions, EntryPointSource, EntryPointType, ExtendedEntryPointInfo } from './entry-points'
export type { FrameworkIdentification, IdentifyFrameworksOptions, StackSummary } from './framework'
export type { DetectProjectTypeOptions, ProjectTypeDetection, TypeEvidence } from './project-type'
export { buildDependencyGraph, findCircularDependencies, getProjectDependencies } from './dependencies'
export { clearEntryPointCache, discoverEntryPoints, ENTRY_POINT_PATTERNS } from './entry-points'
export { clearFrameworkIdentificationCache, identifyFrameworks, usesFramework } from './framework'
export { detectProjectType } from './project-type'
