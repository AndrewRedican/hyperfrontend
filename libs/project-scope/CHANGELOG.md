# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...f7402da4043201d00015d4d70ab5fed39908a46c) - 2026-11-07

### Features

- recognise hf.json as a workspace marker

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

## [0.5.1](https://github.com/AndrewRedican/hyperfrontend/compare/26d9e6c609557d561dac4ad9179417adc7d3755f...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
- **tool-package:** release a library the graph rebuilds

## [0.5.0](https://github.com/AndrewRedican/hyperfrontend/compare/f37ceab9d2cfb0e0bf05743be43c593842126850...9efd63cbe268b1103496863894a05adc572641e0) - 2026-11-05

### Features

- add shimCommand for starting windows cmd shims
- export isMac and isLinux beside isWindows

### Bug Fixes

- double trailing backslashes in quoteForCmd without a backtracking regex
- probe file system case sensitivity on every platform

## [0.4.2](https://github.com/AndrewRedican/hyperfrontend/compare/1bc7b10e43d8018c0d69858963d444b61d779288...88748aaa668a66fede2a04f4aa4b84a0fe6e4588) - 2026-10-31

### Bug Fixes

- declare DetectionSource in the tech entry that owns it

## [0.4.1](https://github.com/AndrewRedican/hyperfrontend/compare/f83ba11a155be922f200d00abb89c39d1e3982c7...54c7921f6dc19e82f4f149d95566e42fb4aca5f8) - 2026-10-28

### Bug Fixes

- walk each directory once when following symlinks

## [0.4.0](https://github.com/AndrewRedican/hyperfrontend/compare/07570357d738e1194aee2d1387253432b0add3c8...1e12b8201eb30b82352b2f4d88d5f7663991f358) - 2026-10-24

### Features

- add createMemoryTree for trees held entirely in memory

### Bug Fixes

- commit a memory tree into memory instead of onto disk

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/5d6aaa1c9353303f77b6ac186afba9720b948d84...28ab8c85dd6b02b45c755c6ddbd19adc54645fe8) - 2026-10-14

### Features

- add workspaceRelativePath and document the portable path convention

### Bug Fixes

- retry directory removal on transient windows locks

## [0.2.8](https://github.com/AndrewRedican/hyperfrontend/compare/5a49a82851e6018aa9921fd9b0d94fb5d025220f...793105a4c3e18eaa043e6b7307f95ba143b9fdcf) - 2026-10-11

### Bug Fixes

- link the cli entry on node 18 without util.parseArgs

## [0.2.7](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...9cb8baf39ab84f10d5585969ad5afb8bd299def0) - 2026-10-04

### Bug Fixes

- handle crlf line endings when splitting text
- match globs against native windows paths
- report relative paths with posix separators

## [0.2.6](https://github.com/AndrewRedican/hyperfrontend/compare/0244581568624d41cfb65141f66003ecaea17718...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- stop walkTree at a directory symlink and validate symlinks on directory queries
- reject a nul byte in any tree path before it is buffered
- apply gitignore negation and directory-only patterns the way git does
- let a walker swallow only filesystem failures
- build core/logger as its own entry instead of a file module

## [0.2.5](https://github.com/AndrewRedican/hyperfrontend/compare/d07b3add2620b9c6e9ddcf48e01571b8788a3bc7...e2e420bc66425a7fbd7800b76537ee6df301855b) - 2026-09-11

### Bug Fixes

- derive a config format from its extension when the pattern declares none

## [0.2.4](https://github.com/AndrewRedican/hyperfrontend/compare/6b5a02be62850b0509b9fd71ad9232655cf5fbbf...a830a2c5d3a9b7c9c9955a42823b49a4aaa4b3e8) - 2026-08-01

### Bug Fixes

- read cache timestamps via the immutable copy

## [0.2.3](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...7fb26b6a30c007cd0392f1fc973265c3d25e16dd) - 2026-06-28

### Bug Fixes

- confine import resolution to the project root
- reject NUL-byte paths in fs primitives

## [0.2.2](https://github.com/AndrewRedican/hyperfrontend/compare/d96fee4d4d3a70178c8a01e5f2e2ae675fa23f37...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.2.1](https://github.com/AndrewRedican/hyperfrontend/compare/a9185d9b783d7d8d51cc4ad91eb3178eba3e3930...61a93d778d6b84915c51120f315e81b3a16fd67c) - 2026-04-06

### Bug Fixes

- **@hyperfrontend/workspace:** define local custom eslint rules plugin globally on config files
- use @hyperfrontend/logging api execlusively for logging

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-project-scope@0.1.0...lib-project-scope@0.2.0) - 2026-03-16

### Other

- Version sync (no direct changes to this package)

## 0.1.0 - 2026-03-08

### Features

- **lib-project-scope:** complete implementation ([6075fbd](https://github.com/AndrewRedican/hyperfrontend/commit/6075fbd8a8b3b790715d0985612d07a1fb398020))
