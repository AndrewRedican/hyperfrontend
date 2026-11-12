# Changelog

All notable changes to this project will be documented in this file.

## [0.5.3](https://github.com/AndrewRedican/hyperfrontend/compare/b5eefe8d581c111792730f9d42dcbce5ce8c24e7...53c5568a9af0f5ee16b6188d3373feb7375ed249) - 2026-11-12

### Dependency Updates

- **lib-workspace:** typecheck on the engine's own typescript before the workspace's

## [0.5.2](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...998de01185d0dd0a73bb3c4fff5ca8d33b06703e) - 2026-11-07

### Bug Fixes

- install a packed consumer without trusting cached package metadata

### Dependency Updates

- **lib-workspace:** add the build, test, typecheck, e2e and publish executors
- **lib-builder:** run the rollup worker on the main thread only

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
