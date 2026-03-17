# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.4...lib-logging@0.1.0) - 2026-03-16

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

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.3...lib-logging@0.0.4) - 2026-03-08

### Bug Fixes

- **lib-logging:** correct package exports ([3a7fe5a](https://github.com/AndrewRedican/hyperfrontend/commit/3a7fe5a377743bdd7da66f93a38ec416070572b3))

## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.2...lib-logging@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-logging:** correct package exports ([3a7fe5a](https://github.com/AndrewRedican/hyperfrontend/commit/3a7fe5a377743bdd7da66f93a38ec416070572b3))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.1...lib-logging@0.0.2) - 2026-02-26


## 0.0.1 - 2026-02-15

### Bug Fixes

- **tool-package:** fix changelog duplication by clearing header before semver regeneration ([98fbce1](https://github.com/AndrewRedican/hyperfrontend/commit/98fbce19098298414bd243fc3442c159c2ed5b82))
