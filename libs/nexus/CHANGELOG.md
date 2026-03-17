# Changelog

All notable changes to this project will be documented in this file.

## 1.1.0 - 2026-03-16

### Features

- **lib-versioning:** support commit amend no edit
- **lib-versioning:** support force bump with release as config
- **tool-package:** improve memory management and visibility on builder executor
- **eslint-rules:** lib-ts-config-paths
- **e2e-lib-versioning:** test cjs and esm builds
- **eslint-rules:** lib-e2e-project-required
- **lib-versioning:** implement project versioning
- **eslint-rules:** ensure publishable libraries accounted for in docs
- **eslint-rules:** add rule to ensure pipeline is ready for publishable libraries
- **eslint-rules:** root readme.md rule to ensure packages are listed
- **eslint-rules:** rules to align readme.md content format

### Bug Fixes

- **lib-versioning:** remove unused %h format causing git log field misalignment
- **lib-immutable-api-utils:** rename safe object to prevent variable shadowing on cjs module init

## 1.0.1 - 2026-03-08


## 1.0.0 - 2026-03-02

### Bug Fixes

- **lib-nexus:** correct package exports ([721b795](https://github.com/AndrewRedican/hyperfrontend/commit/721b795849b571fdd8229cf3b38fad2699a36217))

### Code Refactoring

- **lib-nexus:** refactor internal workings of logging, and extend logging configuration options ([450a9a8](https://github.com/AndrewRedican/hyperfrontend/commit/450a9a80739c366755bd5f811f63ff83ec20290a))

### ⚠ BREAKING CHANGES

- **lib-nexus:** debug mode property is no longer available, instead there is a method to specify

## 0.1.3 - 2026-02-27


## 0.1.1 - 2026-02-26


## 0.1.0 - 2026-02-15

### Features

- **lib-nexus:** add simplified event subscription ([09dbfe4](https://github.com/AndrewRedican/hyperfrontend/commit/09dbfe47594f1aae765a9a94e5aa444c4cfd2051))

### Bug Fixes

- **tool-package:** fix changelog duplication by clearing header before semver regeneration ([98fbce1](https://github.com/AndrewRedican/hyperfrontend/commit/98fbce19098298414bd243fc3442c159c2ed5b82))
