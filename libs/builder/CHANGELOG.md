# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...00a55ae56a9d3777e9b21f68950c6510f8401a7c) - 2026-06-27

### Bug Fixes

- self-locate workers beside the running module to make the builder embeddable

## 0.1.0 - 2026-06-23

### Features

- clean project outputPath before emit, guarded to dist/<project>
- default EsmConfig/CjsConfig.bundleWorkspaceDeps to true when omitted
- wire BuildConfig.verbose into logger level (debug vs error)
- use HEAD in license URLs and fix stale spec-file type errors
- bail require-destructure to namespace from for non-ident/reserved-word export names, fixing invalid const { default } / { foo-bar } chunks
- tighten CJS dep output; prune bare-require demand, emit const bindings, and detructure namespace requires on acylic edges
- strip ordinary comments from _dependencies/** chenks, preserving @__PURE__ and legal annotations
- sweep empty dirs package-wide at end of bundle phase
- recognize pure .bind of global-rooted callees so dead bind-initialized dep exports prune
- tree-shake unread slots from kept frozen-namespace objects across ESM and CJS deps
- recognize aliased pure freezes and @__PURE__ calls so more dead initializers prune
- treat pure Object.freeze of fresh literals as side-effect-free so dead frozen namespaces collapse
- stop shipping JS sourcemaps from prod builds by default
- reflect package.json#files from emitted output as the final build step
- deliver CDN bundle via unpkg/jsdelivr only, drop ./bundle from exports
- add reflective files-allowlist that walks the emitted output tree
- prune dead hoisted dependencies d.ts via type-graph reachability
- strip dead code from hoisted dependencies
- prune unreachable _dependencies chunks for bundle output
- route per-entry workspace-dep imports through _dependencies/ chunks
- hoist workspace deps to _dependencies/, dedup per-entry d.ts via sibling-externalize plugin
- externalize typescript, auto-wire bin, prune orphan d.ts, default licenses, gate tarball via files allowlist
- posject inject workerization
- workerize bin script bundling via dispatchRollupWorker
- set rollup CJS output.interop='compat' to fix default imports of externalized bundled deps
- per-entry rollup workerization
- pipeline-wide memory observability + SEA fuse-split fix
- self-containment via bundleAllDeps + worker-isolated pre-pass
- instrument runBundlePhase with optional memory monitor checkpoints
- add hf-build cli bin
- add preset and build() facade
- add native bin subdomain (Node SEA)
- add bin subdomain (JS)
- add package subdomain
- add bundle subdomain
- add models and memory subpaths
- scaffold publishable library shell

### Bug Fixes

- emit const (not var) require bindings in entry/bin CJS via rollup constBindings
- include \\r in strip-comments blank class so CRLF whole-line comments collapse
- demote native-bin memory/timing diagnostics from log.info to log.debug
- scope orphan-sween bail to dep chunks, stop first-party dynamic imports disabling _dependencies/ prune
- add missing WorkspaceBundleDep / WorkspaceDepHoistPolicy to root barrel
- reScan template substitutions in comment strip to keep backtick polarity, fixing chunk corruption
- flatten shared internal d.ts dirs for libraries without a root entry
- dedup CJS shared internals symmetrically and drop dead hoisted imports
- prune SEA build intermediates after injection so only the runtime binary ships
- recurse orphan-dts prune over whole tree via entry-reachability so dist == shipped
- flatten per-entry d.ts for workspace-only deps and guard orphan-prune against referenced siblings
- preserve internal non-entry src subdirectories when flattening declarations
- add type casting that would otherwise be inferred but rollup typescript plugin is struggling with
- bundle subpath-only workspace deps via granular hoisting default
- route pre-pass _dependencies/ chunks through canonical externalize plugin
