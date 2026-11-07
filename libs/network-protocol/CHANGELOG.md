# Changelog

All notable changes to this project will be documented in this file.

## [2.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...f7402da4043201d00015d4d70ab5fed39908a46c) - 2026-11-07

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

## [2.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Breaking Changes

- **BREAKING** **lib-builder:** stop loading the rollup worker from the bundle/rollup entry
- **BREAKING** **lib-builder:** emit index.mjs and index.cjs for module outputs
- **BREAKING** **lib-builder:** fail the build on a declared export it cannot publish

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
- **tool-package:** release a library the graph rebuilds
- **lib-json-utils:** keep the nested-quantifier probes linear on repeated parentheses
- **tool-package:** declare operating systems in make-publishable output
- **tool-package:** quote the e2e and publish executors' npm spawns for cmd.exe
- **tool-package:** run the nx e2e suites one at a time on windows
- **lib-builder:** keep platform-restricted packages external
- **lib-builder:** keep chunks a bare side-effect import reaches
- **lib-cryptography:** return an ArrayBuffer-backed array from getRandomValues
- **lib-string-utils:** accept any ArrayBufferLike in arrayBufferToUtf8String
- **lib-string-utils:** return an ArrayBuffer-backed array from utf8StringToUint8Array
- **lib-immutable-api-utils:** return ArrayBuffer-backed views from the typed array factories
- **lib-builder:** fail the build on a declaration alias cycle between entries
- **lib-builder:** list every third-party package the output inlines in THIRD_PARTY_LICENSES.md
- **lib-builder:** reproduce dependency license texts in THIRD_PARTY_LICENSES.md
- **tool-package:** drop npm's silent flag from the version remedies
- **tool-package:** locate generator templates from the tree root
- **tool-package:** add a provenance option to the publish executor
- **tool-package:** locate the test runner from the workspace root
- **lib-json-utils:** rethrow what is not the parser's own failure
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
- **lib-json-utils:** add a json parser that keeps node positions
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
- **lib-cryptography:** read the web crypto subtle global at first use
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

## [2.0.1](https://github.com/AndrewRedican/hyperfrontend/compare/e25d9f8086e811f1bef3e27faa26c5154b35956d...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- keep a queue draining after its handler rejects
- validate the drop handler when a channel is created

## [2.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/106ce4517092cdfa9f222b73d938d272c333d69b...c2798e1479f78d5909adb098595846152a6f9350) - 2026-09-07

### Breaking Changes

- **BREAKING** the browser/v1, browser/v2, node/v1, and node/v2 entries, the bundle/v1 and bundle/v2 builds, the password-keyed packet and data exports, and the six staged queues are removed; createChannel takes an options object with a session, ProtocolProvider receives the session, and Data no longer carries a key.

### Features

- **BREAKING** replace v1/v2 with the v3/v4 session

## [1.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...57e00623ade790f3ae8a2aa4f3b78316bd8b844d) - 2026-08-31

### Features

- Marked stable. No API changes since 0.2.1.

## [0.2.1](https://github.com/AndrewRedican/hyperfrontend/compare/a0ce00788db9fe1c2b1acf06dd59b2622cb1ed3f...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/a9185d9b783d7d8d51cc4ad91eb3178eba3e3930...8a05c80832de91cd61f8af064b417870ea1e3b01) - 2026-04-13

### Features

- **eslint-rules:** add lib-pkg-main-reexports

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.4...lib-network-protocol@0.1.0) - 2026-03-16

### Other

- Version sync (no direct changes to this package)

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.3...lib-network-protocol@0.0.4) - 2026-03-08

### Bug Fixes

- **lib-network-protocol:** correct package exports ([5b8ed3c](https://github.com/AndrewRedican/hyperfrontend/commit/5b8ed3c15a46716f973ab09907913091735160f2))

## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.2...lib-network-protocol@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-network-protocol:** correct package exports ([5b8ed3c](https://github.com/AndrewRedican/hyperfrontend/commit/5b8ed3c15a46716f973ab09907913091735160f2))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.1...lib-network-protocol@0.0.2) - 2026-02-26

### Bug Fixes

- **lib-network-protocol:** correct secondary entrypoints ([7092e3a](https://github.com/AndrewRedican/hyperfrontend/commit/7092e3af8a57829138e1c4dc38ed0f39e2e869d2))

## 0.0.1 - 2026-02-15

### Bug Fixes

- **lib-network-protocol:** fix imports ([5f6f6a9](https://github.com/AndrewRedican/hyperfrontend/commit/5f6f6a9b29f0ad148f9ad929ae5ca06d5da82299))
- **lib-network-protocol:** resolve stop/resume race condition in queue ([cc9d83f](https://github.com/AndrewRedican/hyperfrontend/commit/cc9d83fe014e9540c4033722b75ae868d321811a))
