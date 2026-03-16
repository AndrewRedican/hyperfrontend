# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-03-16

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

## 0.0.4

### Bug Fixes

- **lib-state-machine:** correct package exports and main entrypoint ([81c47c8](https://github.com/AndrewRedican/hyperfrontend/commit/81c47c8a7d5e5ef36b5ec5c64f2c7cc1f0bea18d))

## 0.0.3

### Bug Fixes

- **lib-state-machine:** correct package exports and main entrypoint ([81c47c8](https://github.com/AndrewRedican/hyperfrontend/commit/81c47c8a7d5e5ef36b5ec5c64f2c7cc1f0bea18d))

## 0.0.2


## 0.0.1 - 2026-02-15

### Bug Fixes

- **lib-state-machine:** fix typos and argument handling ([f641a1f](https://github.com/AndrewRedican/hyperfrontend/commit/f641a1fb1a1c60c2bd8a9d6ae484e3a888be55aa))
- **tool-package:** fix changelog duplication by clearing header before semver regeneration ([98fbce1](https://github.com/AndrewRedican/hyperfrontend/commit/98fbce19098298414bd243fc3442c159c2ed5b82))
