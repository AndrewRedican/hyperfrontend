# Changelog

All notable changes to this project will be documented in this file.

## [0.3.2](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...8f5e7079944067c582c6ea6b9c9ffdf0bae978ce) - 2026-11-07

### Dependency Updates

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

## [0.3.1](https://github.com/AndrewRedican/hyperfrontend/compare/26d9e6c609557d561dac4ad9179417adc7d3755f...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
- **tool-package:** release a library the graph rebuilds

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/53020db1cc2866f0363c72c738ac1dcb671bfaf2...9efd63cbe268b1103496863894a05adc572641e0) - 2026-11-05

### Features

- report regex repetitions that take quadratic time in no-unsafe-regex

### Bug Fixes

- rewrite its quadratic regexes as linear ones
- read lookbehinds as groups in the no-unsafe-regex nesting check

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/1bc7b10e43d8018c0d69858963d444b61d779288...1f922d33dad2e3cf7f8c525c5d99a69ac2508094) - 2026-11-01

### Breaking Changes

- **BREAKING** fail an invalid rule case whose fix the spec does not declare

### Features

- **BREAKING** fail an invalid rule case whose fix the spec does not declare

## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/0fddb51472b558e4512b21a3a2e59747730085ff...54c7921f6dc19e82f4f149d95566e42fb4aca5f8) - 2026-10-28

### Bug Fixes

- keep the cause of a file's failure and print its stack
- push unresolved references and segments in a loop

### Performance

- key duplicate case labels by their tokens

## 0.1.0 - 2026-10-23

### Features

- extract the workspace linter as @hyperfrontend/linter
