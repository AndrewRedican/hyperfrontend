# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...a0f7b54607f0a998df303d4f46418c5b47e8dce8) - 2026-11-05

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

## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/29dc54d58c2b3c8b8dd35f7c546ebc6cd9191f6e...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- accept arrays, functions and class instances in fifo and lifo lists

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...cc16961a470190848f71a7cce41f7377bc4511a4) - 2026-08-25

### Breaking Changes

- **BREAKING** type fifo pull as T | undefined, reword throws

### Bug Fixes

- **BREAKING** type fifo pull as T | undefined, reword throws

## [0.0.5](https://github.com/AndrewRedican/hyperfrontend/compare/c8db08be8b183addd26caf81fdd17fb3693f296f...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-list-utils@0.0.3...lib-list-utils@0.0.4) - 2026-03-08


## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-list-utils@0.0.2...lib-list-utils@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-list-utils:** correct package exports ([5966537](https://github.com/AndrewRedican/hyperfrontend/commit/5966537bda3addd6d3bc22bb7b2e9a5cfef7c247))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-list-utils@0.0.1...lib-list-utils@0.0.2) - 2026-02-26


## 0.0.1 - 2026-02-15

