# Changelog

All notable changes to this project will be documented in this file.

## [0.5.2](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...f7402da4043201d00015d4d70ab5fed39908a46c) - 2026-11-07

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

## [0.5.0](https://github.com/AndrewRedican/hyperfrontend/compare/53020db1cc2866f0363c72c738ac1dcb671bfaf2...9efd63cbe268b1103496863894a05adc572641e0) - 2026-11-05

### Features

- add shimCommand to the process entry

### Bug Fixes

- double trailing backslashes in quoteForCmd without a backtracking regex
- quote the packed consumer's npm install for cmd.exe

## [0.4.0](https://github.com/AndrewRedican/hyperfrontend/compare/1bc7b10e43d8018c0d69858963d444b61d779288...1f922d33dad2e3cf7f8c525c5d99a69ac2508094) - 2026-11-01

### Features

- add sendSignal and cleanSignalExit

### Bug Fixes

- run a project's tests from the real path of its root
- match setup files by their real path

## [0.3.1](https://github.com/AndrewRedican/hyperfrontend/compare/39ff2bee8839058dfa45401b99b370470aa79521...54c7921f6dc19e82f4f149d95566e42fb4aca5f8) - 2026-10-28

### Bug Fixes

- pass consumer run arguments and result path through the environment

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/f83ba11a155be922f200d00abb89c39d1e3982c7...2faa3ba57520a4e3248ea899da0d5266eb3c9a01) - 2026-10-25

### Features

- drive a packed package from a consumer entry

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/9e6cdcc777484b3f38ca87cfea42d4cb758075a6...1e12b8201eb30b82352b2f4d88d5f7663991f358) - 2026-10-24

### Features

- deliver a late ResizeObserver notification with resizeLate
- add the browser entry for linked windows and a driven ResizeObserver
- add the process entry for terminal, stdio and child process stand-ins
- add the fs entry for self-cleaning temporary directories and fixture trees
- add clearMocks, resetMocks and restoreMocks to the test config
- add waitFor, waitUntil, flushPromises, sleep and createDeferred
- add createMock for typed, automatically mocked objects
- add jest.replaceProperty, jest.stubEnv and jest.stubGlobal

### Bug Fixes

- reset a mock to the implementation it was created with
- type a fake child's pid as possibly undefined, as Node does

## 0.1.0 - 2026-10-15

### Features

- promote the test runtime to the publishable @hyperfrontend/testing package

### Bug Fixes

- read the alias file in one step instead of checking it first
