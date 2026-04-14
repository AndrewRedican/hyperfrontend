/**
 * Package discovery, changelog finding, and dependency graph construction for monorepos.
 *
 * @module @hyperfrontend/versioning/workspace/discovery
 */
export type { DependencyGraph, DependencyType, DependencyEdge, DependencyGraphAnalysis } from './dependencies'
export type { DiscoveredChangelog } from './discover-changelogs'
export type { DiscoveryOptions, DiscoveryResult } from './packages'
export { hasChangelog, getExpectedChangelogPath } from './changelog-path'
export {
  findInternalDependencies,
  findInternalDependenciesWithTypes,
  buildDependencyGraph,
  getTopologicalOrder,
  getTransitiveDependents,
  getTransitiveDependencies,
  transitivelyDependsOn,
} from './dependencies'
export {
  CHANGELOG_NAMES,
  findChangelogs,
  findChangelogsInTree,
  findProjectChangelog,
  findProjectChangelogInTree,
  discoverAllChangelogs,
} from './discover-changelogs'
export { discoverPackages, discoverProject, discoverProjectByName } from './packages'
