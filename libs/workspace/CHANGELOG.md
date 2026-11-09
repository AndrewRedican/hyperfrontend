# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/b5eefe8d581c111792730f9d42dcbce5ce8c24e7...26bc4bfd43c5b267e36406c600203c603df7c169) - 2026-11-09

### Bug Fixes

- refuse a manifest entry without its module key, naming the key
- verify the base of an affected run and fall back to main
- write the library manifest as an es module package
- settle the root manifest as an es module package with node types
- typecheck on the engine's own typescript before the workspace's

### Dependency Updates

- **lib-builder:** resolve tsc beside the builder before the workspace root

## 0.1.0 - 2026-11-07

### Features

- publish the projects rule family as the lint entry
- add the workspace, library, make-publishable, rename and move generators
- add the version, version-check and version-batch executors
- add the build, test, typecheck, e2e and publish executors
- add the workspace package with its graph, runner and hf
