# Changelog

All notable changes to this project will be documented in this file.

## [0.3.4](https://github.com/AndrewRedican/hyperfrontend/compare/b5eefe8d581c111792730f9d42dcbce5ce8c24e7...53c5568a9af0f5ee16b6188d3373feb7375ed249) - 2026-11-12

### Dependency Updates

- **lib-workspace:** typecheck on the engine's own typescript before the workspace's

## [0.3.3](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...998de01185d0dd0a73bb3c4fff5ca8d33b06703e) - 2026-11-07

### Dependency Updates

- **lib-workspace:** add the build, test, typecheck, e2e and publish executors
- **lib-builder:** run the rollup worker on the main thread only

## [0.3.2](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

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

## [0.3.1](https://github.com/AndrewRedican/hyperfrontend/compare/135d10985b6f139f816af06c6e3996abf338d21d...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- reject a choice prompt no keypress could resolve
- submit the text before a trailing line ending in the same chunk
- cancel a waiting prompt when the input ends

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...7e783d3d9e6b6b3a42d226b44256b943958a5813) - 2026-08-04

### Features

- support clipboard paste and resize-aware redraw

## [0.2.1](https://github.com/AndrewRedican/hyperfrontend/compare/926d40cab470e589fc30a1ef3a61ca764ff047bd...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/587d0dc108d5bb7f48c44a5a0065e349c774e4cf...b5f254d41cb9549c783146db48eff78ed39e5bf5) - 2026-04-25

### Features

- add filter as you type search on select prompt

### Bug Fixes

- prompt cursor math and add live text render hook

## 0.1.0 - 2026-04-20

### Features

- new package for terminal questions
