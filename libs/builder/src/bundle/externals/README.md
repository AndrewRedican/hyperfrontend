# externals

Externals resolution primitives: `package.json` scanning and globals validation for IIFE / UMD bundles.

`resolveExternals({ packageJsonPath, additional, isWorkspacePackage, bundleWorkspaceDeps })` reads the project's `package.json` and combines its `dependencies`, `peerDependencies`, and the caller-supplied `additional` list into a sorted, de-duplicated external list, stripping workspace-internal entries when `bundleWorkspaceDeps` is `true`. `validateExternalsConfig(external, globals)` fails fast when an IIFE / UMD bundle declares an external package without a corresponding global variable name.
