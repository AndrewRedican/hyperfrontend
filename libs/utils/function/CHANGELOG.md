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

- swallow the rejection of a promise the error-ignoring wrapper returns
- call the wrapped function with the receiver the wrapper was invoked on

## [1.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...e0f45f05f9bbd40569948eab2389a74df5818015) - 2026-08-31

### Features

- Marked stable. No API changes since 0.0.5.

## [0.0.5](https://github.com/AndrewRedican/hyperfrontend/compare/c8db08be8b183addd26caf81fdd17fb3693f296f...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-function-utils@0.0.3...lib-function-utils@0.0.4) - 2026-03-08


## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-function-utils@0.0.2...lib-function-utils@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-function-utils:** correct package exports ([d4bb6d8](https://github.com/AndrewRedican/hyperfrontend/commit/d4bb6d80a8cccdb69d3fc06b496d1b0f295c5160))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-function-utils@0.0.1...lib-function-utils@0.0.2) - 2026-02-26


## 0.0.1 - 2026-02-15

