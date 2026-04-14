/**
 * Entry point discovery with configurable patterns for detecting main files and module boundaries.
 *
 * @module @hyperfrontend/project-scope/heuristics/entry-points
 */
export type { DiscoverEntryPointsOptions, EntryPointSource, EntryPointType, ExtendedEntryPointInfo } from './discover'
export { clearEntryPointCache, discoverEntryPoints, ENTRY_POINT_PATTERNS } from './discover'
