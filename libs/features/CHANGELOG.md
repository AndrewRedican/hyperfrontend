# Changelog

All notable changes to this project will be documented in this file.

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
