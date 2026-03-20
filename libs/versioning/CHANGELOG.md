# Changelog

All notable changes to this project will be documented in this file.

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
