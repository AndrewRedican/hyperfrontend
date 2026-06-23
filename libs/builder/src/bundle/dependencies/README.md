# dependencies

Per-format pre-pass + externalize plugin that build each third-party dep once into `_dependencies/<dep>/`, then route every entry's import of that dep through a relative path. Locked per Decision #38 (overview).

`resolveBundledDeps(packageJsonPath, { isWorkspacePackage, include, exclude })` derives the third-party dep set from the project's `package.json#dependencies`, subtracts `peerDependencies` (those stay external) and any package matching the workspace predicate (those are inlined per the existing `bundleWorkspaceDeps` flow), and finally applies the caller's `include` / `exclude` overrides — `exclude` always wins over `include`, and neither can resurrect a peer or workspace dep.

`createExternalizeBundledDepsPlugin({ deps, entryOutDir, format, depsRoot })` returns a Rollup plugin whose `resolveId` hook maps any import of a bundled dep (or its subpath) to a relative import that points at `_dependencies/<dep>/index.<ext>`. Node builtins and `node:*` specifiers are marked external untouched. Unrelated imports return `null` so the rest of the plugin chain handles them. Used by the per-entry passes for `'esm'` / `'cjs'` and by the d.ts pass for `'dts'`.

`runPrePass(jobs, { workerPath, monitor })` orchestrates the per-dep × per-format rollup invocations as forked Node child processes (Decision #39). Each child runs exactly one rollup invocation, writes its output, and emits a JSON report. Strictly sequential — concurrent workers would simultaneously pressure RAM. The orchestrator throws with the failed job's context if any worker exits non-zero or fails to write its report.
