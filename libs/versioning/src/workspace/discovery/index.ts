// Package discovery
export type { DiscoveryOptions, DiscoveryResult } from './packages'
export { discoverPackages, discoverProject, discoverProjectByName } from './packages'

// Changelog discovery
export type { DiscoveredChangelog } from './discover-changelogs'
export {
  CHANGELOG_NAMES,
  findChangelogs,
  findChangelogsInTree,
  findProjectChangelog,
  findProjectChangelogInTree,
  discoverAllChangelogs,
} from './discover-changelogs'

// Changelog path utilities
export { hasChangelog, getExpectedChangelogPath } from './changelog-path'

// Dependency graph
export type { DependencyGraph, DependencyType, DependencyEdge, DependencyGraphAnalysis } from './dependencies'
export {
  findInternalDependencies,
  findInternalDependenciesWithTypes,
  buildDependencyGraph,
  getTopologicalOrder,
  getTransitiveDependents,
  getTransitiveDependencies,
  transitivelyDependsOn,
} from './dependencies'
