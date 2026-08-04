# init

Nx `init` generator. Ensures `@hyperfrontend/features` is declared in the
consumer workspace's root `package.json`. `nx add @hyperfrontend/features`
installs the package and then runs this generator automatically; it can also be
run directly. Registered via the package's `generators.json`.

A declaration in any dependency section — including `devDependencies`, where
`nx add`'s install step places it — satisfies the check and is never moved
between sections. When the package is undeclared it is added to `dependencies`
(the SDK is a runtime dependency), pinned to a caret range on the running
plugin's own version. Repeat runs are no-ops.

When the workspace has `@nx/devkit` installed, staged files are formatted with
it before Nx writes them to disk. The generator returns an install callback
that Nx runs after flushing: it installs dependencies only when the manifest
actually changed — through the workspace's own `@nx/devkit`
`installPackagesTask` when resolvable, otherwise through a built-in installer
that detects the package manager from the workspace lockfile. The callback
then verifies that rollup's native binding for the current platform is
installed and, when it is missing, prints the exact install command to fix it
(the `hf build` command and the `build` executor need that binding to bundle).

The root `package.json` is the only file the generator touches. Nothing else
in the workspace needs configuration: the package resolves from
`node_modules`, so no `tsconfig` path mappings are required in either classic
or TS-solution workspaces; its generators and executors resolve by package
name without an `nx.json` plugins entry; no lint plugin ships, so ESLint
configuration stays untouched; and the package's own runtime requirements
(`tslib`, `typescript`) install transitively as its dependencies.

## Usage

```bash
nx add @hyperfrontend/features
# or directly
nx g @hyperfrontend/features:init
```

| Option                 | Required | Description                                                                                                      |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `keepExistingVersions` | no       | Keep an existing declaration's range untouched (default `true`); `false` re-pins it to the plugin's own version. |
