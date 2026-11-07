# Changelog

All notable changes to this project will be documented in this file.

## [0.2.3](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...f7402da4043201d00015d4d70ab5fed39908a46c) - 2026-11-07

### Dependency Updates

- **lib-workspace:** print a channel header only above a line that shows
- **lib-workspace:** refuse a batch whose revisions git cannot compare
- **lib-workspace:** report usage mistakes without a stack trace
- **lib-workspace:** count a partial batch failure in the plural
- **lib-workspace:** restore the batch log level after a library run throws
- **lib-workspace:** accept a range of @hyperfrontend/testing as a peer
- **lib-workspace:** leave peer ranges alone when bumping dependents
- **lib-workspace:** ignore coverage output in the .gitignore the workspace generator writes
- **lib-workspace:** make the package publishable
- **lib-workspace:** join project paths portably in the version executors and the dependency reader
- **lib-workspace:** leave installed packages out of the file list whatever the repository ignores
- **lib-workspace:** keep the suites of an e2e project that exists before the library publishes
- **lib-workspace:** stamp the graph caches with the installed engine version
- **lib-builder:** run the rollup worker on the main thread only
- **lib-workspace:** name every bumped library in the batch commit subject
- **lib-workspace:** add the generators and the helpers they are built from
- **lib-workspace:** add a missing package to one manifest section when every fix applies
- **lib-workspace:** publish the projects rule family as the lint entry
- **lib-workspace:** add the version, version-check and version-batch executors
- **tool-package:** restore the tree as it stood when the batch fails
- **lib-workspace:** add the workspace graph, runner, hf and executors

## [0.2.2](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Breaking Changes

- **BREAKING** **lib-builder:** stop loading the rollup worker from the bundle/rollup entry
- **BREAKING** **lib-builder:** emit index.mjs and index.cjs for module outputs
- **BREAKING** **lib-builder:** fail the build on a declared export it cannot publish

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
- **tool-package:** release a library the graph rebuilds
- **tool-package:** declare operating systems in make-publishable output
- **tool-package:** quote the e2e and publish executors' npm spawns for cmd.exe
- **tool-package:** run the nx e2e suites one at a time on windows
- **lib-builder:** keep platform-restricted packages external
- **lib-builder:** keep chunks a bare side-effect import reaches
- **lib-builder:** fail the build on a declaration alias cycle between entries
- **lib-builder:** list every third-party package the output inlines in THIRD_PARTY_LICENSES.md
- **lib-builder:** reproduce dependency license texts in THIRD_PARTY_LICENSES.md
- **tool-package:** drop npm's silent flag from the version remedies
- **tool-package:** locate generator templates from the tree root
- **tool-package:** add a provenance option to the publish executor
- **tool-package:** locate the test runner from the workspace root
- **tool-package:** scaffold e2e specs on the packed consumer
- **tool-package:** hand e2e suites the packed tarball path
- **lib-builder:** skip type checking in workers that drop diagnostics
- **lib-builder:** build browser bundles from one entry, refuse several
- **lib-builder:** inline dynamic imports into each library entry bundle
- **tool-package:** drop the e2e template's unknown rule directive
- **tool-package:** keep existing config when make-publishable re-runs
- **tool-package:** import make-publishable statically
- **tool-package:** scaffold libraries with the workspace lint config
- **lib-builder:** strip lint pragmas from bundled dependency code
- **tool-package:** typecheck each project's spec config alongside its library config
- **tool-package:** scaffold e2e projects with an audit target and assertive spec names
- **tool-package:** scaffold libraries at 0.0.0 with a bare test target and runner config types
- **tool-package:** register a publishable library in ci, the root readme and the docs site
- **lib-builder:** build the bin descriptor's output dir natively
- **lib-builder:** keep resolved workspace dependency paths native
- **tool-package:** quote the tarball path when npm runs through the windows shell
- **lib-builder:** drop type diagnostics computed without path mappings
- **lib-builder:** retry report directory removal on transient windows locks
- **lib-builder:** keep core modules external without module.isBuiltin
- **BREAKING** **lib-builder:** stop loading the rollup worker from the bundle/rollup entry
- **lib-builder:** expose the crypto global to the rollup worker on node 18
- **BREAKING** **lib-builder:** emit index.mjs and index.cjs for module outputs
- **tool-package:** run the tsc entry script on node for typecheck
- **lib-builder:** run the tsc entry script on node for declaration emit
- **tool-package:** pass the e2e executor preloads as file urls
- **tool-package:** pass the test executor preload as a file url
- **tool-package:** report workspace-relative paths with posix separators
- **tool-package:** split text on crlf line endings
- **tool-package:** spawn npm through a shell on windows
- **lib-builder:** split worker stderr on crlf line endings
- **lib-builder:** rewrite only native separators to forward slashes
- **lib-builder:** walk up to package.json from native windows paths
- **lib-builder:** guard bundled deps against native windows paths
- **BREAKING** **lib-builder:** fail the build on a declared export it cannot publish
- **tool-package:** fold the compatibility matrix into the version commit
- **tool-package:** expose the builder clean option to projects
- **lib-builder:** clean only an owned output and add the clean option

## [0.2.1](https://github.com/AndrewRedican/hyperfrontend/compare/725db1b4556be686fd460b69424229a7d5ac5a63...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- replay a lifecycle flag to the newly registered callback only

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...a1f6e3b4e6b9f0ad51c8908b2fb641deed0078e3) - 2026-08-10

### Features

- export store and listener from the store entry

### Bug Fixes

- export model definitions from the models entry

## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/a9185d9b783d7d8d51cc4ad91eb3178eba3e3930...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-state-machine@0.0.4...lib-state-machine@0.1.0) - 2026-03-16

### Other

- Version sync (no direct changes to this package)

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-state-machine@0.0.3...lib-state-machine@0.0.4) - 2026-03-08

### Bug Fixes

- **lib-state-machine:** correct package exports and main entrypoint ([81c47c8](https://github.com/AndrewRedican/hyperfrontend/commit/81c47c8a7d5e5ef36b5ec5c64f2c7cc1f0bea18d))

## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-state-machine@0.0.2...lib-state-machine@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-state-machine:** correct package exports and main entrypoint ([81c47c8](https://github.com/AndrewRedican/hyperfrontend/commit/81c47c8a7d5e5ef36b5ec5c64f2c7cc1f0bea18d))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-state-machine@0.0.1...lib-state-machine@0.0.2) - 2026-02-26


## 0.0.1 - 2026-02-15

### Bug Fixes

- **lib-state-machine:** fix typos and argument handling ([f641a1f](https://github.com/AndrewRedican/hyperfrontend/commit/f641a1fb1a1c60c2bd8a9d6ae484e3a888be55aa))
