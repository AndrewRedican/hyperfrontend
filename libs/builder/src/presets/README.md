# presets

Predicate factories for the `IsWorkspacePackagePredicate` slot on `BuildConfig`.

`byPrefix(scope)` returns a predicate that matches every package whose name starts with the supplied scope (e.g., `byPrefix('@hyperfrontend/')`). Use this when every workspace package shares a single scope. `byNames(names[])` returns a predicate that matches an explicit list of names; reach for it when the workspace exposes packages under heterogeneous scopes or unscoped names that a prefix can't capture. Both factories return stable closures suitable for direct assignment to `BuildConfig.isWorkspacePackage`, opting the build into workspace-aware bundling and dependency-filtering behavior without hand-rolling the predicate.
