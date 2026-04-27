# dependencies

Internal source-code dependency graph construction, circular-dependency detection, and `package.json` dependency categorization.

`buildDependencyGraph` walks source files extracting `import`, `import()`, `require`, and `export-from` specifiers via regex, resolving relative paths to graph nodes with `dependencies`/`dependents` edges and identifying roots (uncalled) and leaves (no outbound deps). `findCircularDependencies` performs DFS cycle detection and returns ordered cycle paths. `getProjectDependencies` categorizes `package.json` entries into runtime, development, peer, and optional buckets with totals.
