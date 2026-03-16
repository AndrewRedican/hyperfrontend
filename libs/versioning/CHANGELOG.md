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
- **docs-site:** add project-scope
- **tool-package:** build executor now takes unpkg and jsdelivr configuration
- **lib-json-utils:** regex pattern safety
- **eslint-rules:** no-unsafe-regex
- **eslint-rules:** no-deprecated-tag
- **lib-project-scope:** complete implementation

### Bug Fixes

- **lib-versioning:** remove unused %h format causing git log field misalignment
- **lib-immutable-api-utils:** rename safe object to prevent variable shadowing on cjs module init
- **@hyperfrontend/workspace:** prevent changelog corruption in pr ci

### Other

- **eslint-rules:** disable angle bracket typecasting on eslint-rules project
