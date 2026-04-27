# discovery

Monorepo discovery: finds packages, locates their changelogs, and builds the internal-dependency graph.

The package-discovery half (`DiscoveryOptions`, `DiscoveryResult`) walks the workspace looking for `package.json` files and produces a normalized list of projects. The changelog half (`hasChangelog`, `getExpectedChangelogPath`, `DiscoveredChangelog`) reports which packages have a `CHANGELOG.md` and where it's expected to live. The dependency-graph half (`findInternalDependencies`, `findInternalDependenciesWithTypes`, `buildDependencyGraph`, `getTopologicalOrder`, `getTransitiveDependents`) computes the per-package dependency edges (`DependencyEdge`, `DependencyType`) and the topological order needed to drive cascade bumps and batch updates safely.
