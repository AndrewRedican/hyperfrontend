# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.4...lib-network-protocol@0.1.0) - 2026-03-16

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

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.3...lib-network-protocol@0.0.4) - 2026-03-08

### Bug Fixes

- **lib-network-protocol:** correct package exports ([5b8ed3c](https://github.com/AndrewRedican/hyperfrontend/commit/5b8ed3c15a46716f973ab09907913091735160f2))

## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.2...lib-network-protocol@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-network-protocol:** correct package exports ([5b8ed3c](https://github.com/AndrewRedican/hyperfrontend/commit/5b8ed3c15a46716f973ab09907913091735160f2))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.1...lib-network-protocol@0.0.2) - 2026-02-26

### Bug Fixes

- **lib-network-protocol:** correct secondary entrypoints ([7092e3a](https://github.com/AndrewRedican/hyperfrontend/commit/7092e3af8a57829138e1c4dc38ed0f39e2e869d2))

## 0.0.1 - 2026-02-15

### Bug Fixes

- **lib-network-protocol:** fix imports ([5f6f6a9](https://github.com/AndrewRedican/hyperfrontend/commit/5f6f6a9b29f0ad148f9ad929ae5ca06d5da82299))
- **lib-network-protocol:** resolve stop/resume race condition in queue ([cc9d83f](https://github.com/AndrewRedican/hyperfrontend/commit/cc9d83fe014e9540c4033722b75ae868d321811a))
- **tool-package:** fix changelog duplication by clearing header before semver regeneration ([98fbce1](https://github.com/AndrewRedican/hyperfrontend/commit/98fbce19098298414bd243fc3442c159c2ed5b82))
