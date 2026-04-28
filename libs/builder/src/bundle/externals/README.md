# externals

Externals resolution primitives: `package.json` scanning, Rollup external predicates, and globals validation for IIFE / UMD bundles.

`resolveExternals({ packageJsonPath, additional, isWorkspacePackage, bundleWorkspaceDeps })` reads the project's `package.json` and combines its `dependencies`, `peerDependencies`, and the caller-supplied `additional` list into a sorted, de-duplicated external list — stripping workspace-internal entries when `bundleWorkspaceDeps` is `true`. `createExternalFn(externals)` and `createBundleExternalFn(externals?)` wrap that list into Rollup `external` predicates with the right semantics for entry-point and bundle outputs respectively, and `validateExternalsConfig(external, globals)` fails fast when an IIFE / UMD bundle declares an external package without a corresponding global variable name.
