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

- name the rejected level in the invalid log level error
- accept an unknown value in isValidLogLevel and narrow it to a log level

## [1.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...b4b3c79eb77667b0db74d82779a3fbda69e4a0b6) - 2026-08-31

### Features

- Marked stable. No API changes since 0.1.1.

## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/a9185d9b783d7d8d51cc4ad91eb3178eba3e3930...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.4...lib-logging@0.1.0) - 2026-03-16

### Other

- Version sync (no direct changes to this package)

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.3...lib-logging@0.0.4) - 2026-03-08

### Bug Fixes

- **lib-logging:** correct package exports ([3a7fe5a](https://github.com/AndrewRedican/hyperfrontend/commit/3a7fe5a377743bdd7da66f93a38ec416070572b3))

## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.2...lib-logging@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-logging:** correct package exports ([3a7fe5a](https://github.com/AndrewRedican/hyperfrontend/commit/3a7fe5a377743bdd7da66f93a38ec416070572b3))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-logging@0.0.1...lib-logging@0.0.2) - 2026-02-26


## 0.0.1 - 2026-02-15

### Other

- Initial release
