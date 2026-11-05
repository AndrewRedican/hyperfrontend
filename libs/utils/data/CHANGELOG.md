# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...a0f7b54607f0a998df303d4f46418c5b47e8dce8) - 2026-11-05

### Dependency Updates

- **tool-package:** release a library the graph rebuilds
- **tool-package:** declare operating systems in make-publishable output
- **tool-package:** quote the e2e and publish executors' npm spawns for cmd.exe
- **tool-package:** run the nx e2e suites one at a time on windows
- **lib-builder:** keep platform-restricted packages external
- **lib-builder:** keep chunks a bare side-effect import reaches
- **lib-builder:** fail the build on a declaration alias cycle between entries
- **lib-builder:** list every third-party package the output inlines in THIRD_PARTY_LICENSES.md
- **lib-builder:** reproduce dependency license texts in THIRD_PARTY_LICENSES.md
- **tool-package:** drop npm's silent flag from the version remedies
- **tool-package:** locate generator templates from the tree root
- **tool-package:** add a provenance option to the publish executor
- **tool-package:** locate the test runner from the workspace root
- **tool-package:** scaffold e2e specs on the packed consumer
- **tool-package:** hand e2e suites the packed tarball path
- **lib-builder:** skip type checking in workers that drop diagnostics
- **lib-builder:** build browser bundles from one entry, refuse several

## [1.0.1](https://github.com/AndrewRedican/hyperfrontend/compare/106ce4517092cdfa9f222b73d938d272c333d69b...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- track visited references by identity and release them on the way back up
- remove matching array entries back to front in removeKey
- report a readable error when a value along the getValue path is not iterable

## [1.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...280a1dfa344bc5958940eabefdb385223f2a85a1) - 2026-08-31

### Features

- Marked stable. No API changes since 0.0.5.

## [0.0.5](https://github.com/AndrewRedican/hyperfrontend/compare/c8db08be8b183addd26caf81fdd17fb3693f296f...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-data-utils@0.0.3...lib-data-utils@0.0.4) - 2026-03-08

### Bug Fixes

- **lib-data-utils:** correct package exports and dependencies ([7a58375](https://github.com/AndrewRedican/hyperfrontend/commit/7a58375f09946e313994bb6ea14e0807c8563381))

## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-data-utils@0.0.2...lib-data-utils@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-data-utils:** correct package exports and dependencies ([7a58375](https://github.com/AndrewRedican/hyperfrontend/commit/7a58375f09946e313994bb6ea14e0807c8563381))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-data-utils@0.0.1...lib-data-utils@0.0.2) - 2026-02-26


## 0.0.1 - 2026-02-15

