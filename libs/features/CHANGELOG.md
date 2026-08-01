# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/74110dd15151bfc8360ef4edcdb1086cb003c909...5cd51bd3673b8e2635557ba13c7f5da231b9dfaf) - 2026-08-01

### Breaking Changes

- **BREAKING** coordinate presentation host-side with contract-declared display modes
- **BREAKING** throw when registering v2 security without a shared key
- **BREAKING** is Open stays false after open() until the handshake completes; ready() rejects when no host answers

### Features

- adopt a reloaded feature on its existing mount
- **BREAKING** ⚠️ BREAKING: coordinate presentation host-side with contract-declared display modes
- delegate frame permissions and add host-only sandbox containment
- add four-state liveness, closing flush window, and dirty state
- validate action payloads on send and receive
- announce contract versions and gate compatibility
- add hostee security options and shared registration
- add allow-open option to the nx build executor
- **BREAKING** ⚠️ BREAKING: adopt asynchronous wire-gated open with origin pinning and timeout errors

### Bug Fixes

- **BREAKING** ⚠️ BREAKING: throw when registering v2 security without a shared key

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/6b5a02be62850b0509b9fd71ad9232655cf5fbbf...47a37497608ac765af3efb30f0b5e01950bae425) - 2026-07-05

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
