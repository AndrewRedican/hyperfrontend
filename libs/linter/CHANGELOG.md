# Changelog

All notable changes to this project will be documented in this file.

## [0.3.1](https://github.com/AndrewRedican/hyperfrontend/compare/26d9e6c609557d561dac4ad9179417adc7d3755f...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
- **tool-package:** release a library the graph rebuilds

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/53020db1cc2866f0363c72c738ac1dcb671bfaf2...9efd63cbe268b1103496863894a05adc572641e0) - 2026-11-05

### Features

- report regex repetitions that take quadratic time in no-unsafe-regex

### Bug Fixes

- rewrite its quadratic regexes as linear ones
- read lookbehinds as groups in the no-unsafe-regex nesting check

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/1bc7b10e43d8018c0d69858963d444b61d779288...1f922d33dad2e3cf7f8c525c5d99a69ac2508094) - 2026-11-01

### Breaking Changes

- **BREAKING** fail an invalid rule case whose fix the spec does not declare

### Features

- **BREAKING** fail an invalid rule case whose fix the spec does not declare

## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/0fddb51472b558e4512b21a3a2e59747730085ff...54c7921f6dc19e82f4f149d95566e42fb4aca5f8) - 2026-10-28

### Bug Fixes

- keep the cause of a file's failure and print its stack
- push unresolved references and segments in a loop

### Performance

- key duplicate case labels by their tokens

## 0.1.0 - 2026-10-23

### Features

- extract the workspace linter as @hyperfrontend/linter
