# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/6b5a02be62850b0509b9fd71ad9232655cf5fbbf...4084db19f1de72e3859e4eecac8a2b55c957565b) - 2026-07-04

### Features

- add request/response messaging to the shell and feature handles
- generate typed, protocol-carrying, self-contained connectors
- add the experience-plugin lifecycle seam to the shell
- export contract option types from the hostee entry

### Bug Fixes

- locate debug-UI assets from the package bin layout
- bundle workspace deps into the nx plugin entries
- invert feature contracts for host-side channels
- keep hf dev serving and ship a self-locating debug UI
- relativize generated contract imports and type handler stubs

## 0.1.0 - 2026-06-28

### Features

- add devkit-free Nx plugin (feature generator, build/serve executors)
- implement dev server and debug UI
- add hf CLI with init, build, and dev commands
- implement shell generation
- core host and hostee SDK implemented

### Bug Fixes

- verify message origin in debug UI handler
- slug shell names with a linear scan to avoid ReDoS
- escape backslashes in source literals without regex
