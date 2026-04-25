# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0](https://github.com/AndrewRedican/hyperfrontend/compare/587d0dc108d5bb7f48c44a5a0065e349c774e4cf...b5f254d41cb9549c783146db48eff78ed39e5bf5) - 2026-04-25

### Features

- replace polynomial regex in parseReferences
- add cz/cl bin entries with config-driven authoring and validation
- add commits/author session runner with config loader and step preset
- add commits/format pure preview formatter with draft model
- add commits/validate pure rule engine with conventional preset

### Bug Fixes

- commit preview and live subject countdown

## [0.5.4](https://github.com/AndrewRedican/hyperfrontend/compare/a0ce00788db9fe1c2b1acf06dd59b2622cb1ed3f...94b2ccd5f3cd20a7f3c7a503899c6746eaded17e) - 2026-04-20

### Bug Fixes

- make first-release idempotent on re-run

## [0.5.3](https://github.com/AndrewRedican/hyperfrontend/compare/d96fee4d4d3a70178c8a01e5f2e2ae675fa23f37...8a05c80832de91cd61f8af064b417870ea1e3b01) - 2026-04-13

### Bug Fixes

- add missing re-export in main entrypoint

## [0.5.2](https://github.com/AndrewRedican/hyperfrontend/compare/bf1304e36ce20eb196dae60d2b311ab10461860e...61a93d778d6b84915c51120f315e81b3a16fd67c) - 2026-04-06

### Bug Fixes

- **@hyperfrontend/workspace:** define local custom eslint rules plugin globally on config files

## [0.5.1](https://github.com/AndrewRedican/hyperfrontend/compare/f1adb23d9138f218c27c152ac18b9ec3ec554c72...dbc22a50298c81c8558a214abc3d5256db3d40fd) - 2026-03-30

### Bug Fixes

- add end-of-options separator to prevent git argument injection

## [0.5.0](https://github.com/AndrewRedican/hyperfrontend/compare/74ee35afe04d203271bf25992247df1d817c7fc2...3d23dade0efa7172d5311a8676cfe0d52dbe749d) - 2026-03-26

### Features

- support various files changed detection strategies
- support unstable git state detection
- add support to discard git changes

## [0.4.0](https://github.com/AndrewRedican/hyperfrontend/compare/b8e66fb435b8c25cabc5360d735852bffc721916...9380caeb9549901e3803bd6836dfe21a49ff32d8) - 2026-03-22

### Features

- add backup changelog options and use is file for type safe validation
- add vfs-aware discovery for multi-phase flow support
- add rollback on failure option for clean failure recovery
- add diff preview before committing changes
- add list changes observability to flow execution

### Bug Fixes

- prevent command injection in git remote operations
- remove useless initial assigment in parse version from heading
- remove useless initial assignment in fetch-registry

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/31943a4b39484dba86b358e4f361abe76edc4fe1...5d7250d27d1ae16bd36a1e20d91beac21a41600e) - 2026-03-21

### Features

- add commit type to section config option
- add changelog file name config option
- export key configuration constants
- make project prefixes configurable
- add max commit fallback config option

### Bug Fixes

- **eslint-rules:** validate github urls via url parsing

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/a9185d9b783d7d8d51cc4ad91eb3178eba3e3930...bdcdfe00e5c9680e7a1eb925ef69997601d0f393) - 2026-03-20

### Features

- support commit existence verification
- track commits to project dependencies
- support of indirect infra changes tht may be consider for semantic versioning
- add core commit classification engine
- git client now supports get remote url
- support remote repository url comparison
- support remote repository url parsing
- support repository models
- support jscutlery/semver style changelog entries

### Bug Fixes

- idempotently update pre-existing unpublished change log entry
- update calculate bump process to account for unpublished versions

## 0.1.0 - 2026-03-16

### Features

- support commit amend no edit
- support force bump with release as config
- implement project versioning

### Bug Fixes

- remove unused %h format causing git log field misalignment
- **@hyperfrontend/workspace:** prevent changelog corruption in pr ci
