# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0](https://github.com/AndrewRedican/hyperfrontend/compare/641f582281b0d20f2953e47aa7a815c210d916f2...a1f6e3b4e6b9f0ad51c8908b2fb641deed0078e3) - 2026-08-10

### Features

- serve directory urls from their index.html in the dev server

### Bug Fixes

- redirect directory urls to the resolved path, not the raw request
- export the entry types the emitted cross-entry declarations reference

## [0.5.1](https://github.com/AndrewRedican/hyperfrontend/compare/135d10985b6f139f816af06c6e3996abf338d21d...bd296466c3f2a5e25643e7eeff8b1c4bf040e4fc) - 2026-08-04

### Bug Fixes

- hold the cross-origin handshake until the feature frame loads

## [0.5.0](https://github.com/AndrewRedican/hyperfrontend/compare/208793adace114439414819cd1cd8ca9e8b121ca...7e783d3d9e6b6b3a42d226b44256b943958a5813) - 2026-08-04

### Features

- add devkit bridge and nx entry barrels

### Bug Fixes

- make hf init idempotent and partial-apply safe

## [0.4.0](https://github.com/AndrewRedican/hyperfrontend/compare/d07b3add2620b9c6e9ddcf48e01571b8788a3bc7...a6d9ac8c48d1c3edbb8bf54c5a561fb3cde590da) - 2026-08-02

### Features

- accept the extended feature config keys in the authoring type
- type request, handle, and isDirty on generated shell handles

### Bug Fixes

- declare tslib and the rollup platform bindings for cold hf build

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/74110dd15151bfc8360ef4edcdb1086cb003c909...a830a2c5d3a9b7c9c9955a42823b49a4aaa4b3e8) - 2026-08-01

### Breaking Changes

- **BREAKING** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** coordinate presentation host-side with contract-declared display modes
- **BREAKING** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** throw when registering v2 security without a shared key
- **BREAKING** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** is Open stays false after open() until the handshake completes; ready() rejects when no host answers

### Features

- adopt a reloaded feature on its existing mount
- **BREAKING** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** ⚠️ BREAKING: coordinate presentation host-side with contract-declared display modes
- delegate frame permissions and add host-only sandbox containment
- add four-state liveness, closing flush window, and dirty state
- validate action payloads on send and receive
- announce contract versions and gate compatibility
- add hostee security options and shared registration
- add allow-open option to the nx build executor
- **BREAKING** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** ⚠️ BREAKING: adopt asynchronous wire-gated open with origin pinning and timeout errors

### Bug Fixes

- **BREAKING** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** **BREAKING:** ⚠️ BREAKING: throw when registering v2 security without a shared key

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
