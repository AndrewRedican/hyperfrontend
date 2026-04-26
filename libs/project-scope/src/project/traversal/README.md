# traversal

Directory-walking and file-search helpers built around an explicit visitor pattern.

`walkDirectory` and `walkTree` traverse a folder hierarchy, invoking a `WalkVisitor` for every entry; the visitor's `WalkVisitorResult` controls whether to descend, skip, or stop. `findFiles`, `findFilesInTree`, and `findDirectories` are the higher-level shortcuts for "give me everything matching this pattern" use cases, with `FindOptions` covering depth limits, include/exclude globs, and symlink behavior. Designed for static analysis tools that need predictable, side-effect-free directory iteration with backpressure-style control.
