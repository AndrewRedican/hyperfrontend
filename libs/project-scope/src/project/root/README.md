# root

Root-directory detection using marker files for git roots, project roots, and workspace roots.

`findGitRoot` walks up from a starting path until it finds a `.git` directory. `findProjectRoot` looks for the first ancestor containing a `package.json` (or another entry from `ROOT_MARKERS`). `findWorkspaceRoot` is similar but uses `WORKSPACE_MARKERS` (Nx, Lerna, Rush, pnpm/Yarn/npm workspace declarations) so it stops at the monorepo root rather than at any individual package. `findRootDirectory` is the generalized helper that takes a custom marker list. The marker constants are exposed for downstream tools that need to extend or customize the search.
