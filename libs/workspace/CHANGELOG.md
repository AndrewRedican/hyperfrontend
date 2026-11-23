# Changelog

All notable changes to this project will be documented in this file.

## [0.7.1](https://github.com/AndrewRedican/hyperfrontend/compare/0ef83980279c5e4c2f7853543e9d363639ce7e5f...60672c613415304211bef6785da3e406cd23d079) - 2026-11-23

### Bug Fixes

- count a file renamed into an ignored path as deleted

## [0.7.0](https://github.com/AndrewRedican/hyperfrontend/compare/a92f716d9038eb02226ecae1e611c4f60df494d9...bf9080f73e8b9dcf9b13c90999ffe05eb16ad5fc) - 2026-11-22

### Features

- add the application and service generators
- accept the service project kind

### Bug Fixes

- read the changelog repository from the root manifest
- stop generators corrupting or overwriting projects
- tolerate a byte order mark and name malformed inputs
- accept -t for the target of graph affected
- answer --help on every command
- name no unrun tasks when a failed stage left none

## [0.6.0](https://github.com/AndrewRedican/hyperfrontend/compare/a4177536ceb498d803d2dd3039ee691ed342cdea...07659cde52fac26784a4a945672637887d7e63ff) - 2026-11-21

### Features

- resolve a package a project installs itself as npm

## [0.5.0](https://github.com/AndrewRedican/hyperfrontend/compare/58e496517df8dcfda15e670fd4d8e7efb2a19ace...10275f0f99c6dd64b9f56158790585b2b5627863) - 2026-11-21

### Features

- install git hooks with the hooks generator
- add hf push, which runs the push steps and then pushes
- run git hooks from a typed configuration
- judge the base tsconfig in affected runs and releases
- judge a changed tsconfig.base.json by its path aliases

### Dependency Updates

- **lib-versioning:** add a security commit type that releases a patch

## [0.4.0](https://github.com/AndrewRedican/hyperfrontend/compare/92d4d378897da6165a87f5ae6334a0e60e9bc229...804e8b420896c50c5ae5b1cd20dd675ce28e40c4) - 2026-11-20

### Features

- run tasks in stages behind a progress view

## [0.3.1](https://github.com/AndrewRedican/hyperfrontend/compare/ec05257ef2e7854b22a608317abbeb8fd196f960...344550374035f097ad1bdbac4075c46c756e235d) - 2026-11-16

### Bug Fixes

- leave the shared executor helpers out of the release selection

### Dependency Updates

- **lib-versioning:** read semver ranges the way npm does
- **lib-versioning:** bound caret and tilde comparators by the span they stand for

## [0.3.0](https://github.com/AndrewRedican/hyperfrontend/compare/90724553facc3f94b57e1d93ae0d0c872e5a5100...53c5568a9af0f5ee16b6188d3373feb7375ed249) - 2026-11-12

### Features

- leave named inputs out of a selection by name

### Bug Fixes

- leave the engine input out of the release selection instead of the tool edges
- follow a tool's value imports alone when it reaches a task
- read from a tool only the files a projects input names when one names its project
- start only the lint closure from a project's lint configuration

## [0.2.1](https://github.com/AndrewRedican/hyperfrontend/compare/c9764464e392d066128caacbaa07d3ca29a5f1cc...bde40bd09cdb30b8d5bb9f87ca451f274d65d1f2) - 2026-11-11

### Bug Fixes

- leave ignored packages out of the missing dependency sections report
- refuse a task leaving out the options its executor requires
- infer the lint target only where the linter finds a lint config
- explain the skipped task of a project with no edges instead of crashing

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/bdd9c9c1a4f231b20b7c26d83c01824a620b88cb...1fd9c385acf8e1b3d849602586e602dda1533b4f) - 2026-11-10

### Features

- judge a changed hf.json per task by what the task resolves to
- leave a load marked hf-graph opaque out of the graph

### Bug Fixes

- give a package name two manifests carry to the project with a project.json
- find an executor's implementation under src as the runner does

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
