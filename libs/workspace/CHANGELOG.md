# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-11-07

### Features

- make the package publishable
- add the generators and the helpers they are built from
- publish the projects rule family as the lint entry
- add the version, version-check and version-batch executors
- add the workspace graph, runner, hf and executors

### Bug Fixes

- ignore coverage output in the .gitignore the workspace generator writes
- join project paths portably in the version executors and the dependency reader
- leave installed packages out of the file list whatever the repository ignores
- keep the suites of an e2e project that exists before the library publishes
- stamp the graph caches with the installed engine version
- name every bumped library in the batch commit subject
- add a missing package to one manifest section when every fix applies
