# Changelog

All notable changes to this project will be documented in this file.

## [0.0.10](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...a0f7b54607f0a998df303d4f46418c5b47e8dce8) - 2026-11-05

### Dependency Updates

- **tool-package:** release a library the graph rebuilds
- **lib-testing:** double trailing backslashes in quoteForCmd without a backtracking regex
- **tool-package:** declare operating systems in make-publishable output
- **tool-package:** quote the e2e and publish executors' npm spawns for cmd.exe
- **lib-testing:** quote the packed consumer's npm install for cmd.exe
- **lib-testing:** add shimCommand to the process entry
- **tool-package:** run the nx e2e suites one at a time on windows
- **lib-testing:** run a project's tests from the real path of its root
- **lib-testing:** add sendSignal and cleanSignalExit
- **lib-testing:** match setup files by their real path
- **lib-builder:** keep platform-restricted packages external
- **lib-builder:** keep chunks a bare side-effect import reaches
- **lib-builder:** fail the build on a declaration alias cycle between entries
- **lib-builder:** list every third-party package the output inlines in THIRD_PARTY_LICENSES.md
- **lib-builder:** reproduce dependency license texts in THIRD_PARTY_LICENSES.md
- **tool-package:** drop npm's silent flag from the version remedies
- **tool-package:** locate generator templates from the tree root
- **tool-package:** add a provenance option to the publish executor
- **tool-package:** locate the test runner from the workspace root
- **lib-testing:** pass consumer run arguments and result path through the environment
- **tool-package:** scaffold e2e specs on the packed consumer
- **tool-package:** hand e2e suites the packed tarball path
- **lib-testing:** drive a packed package from a consumer entry
- **lib-builder:** skip type checking in workers that drop diagnostics
- **lib-builder:** build browser bundles from one entry, refuse several

## [0.0.9](https://github.com/AndrewRedican/hyperfrontend/compare/a638efc58ce78e9a84dd21992e7f5c675bd5e7f6...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- give each entry its own declarations by moving the sources into the entry directories
- reclaim a stylesheet label whose element left the document
- escape the value of an attribute selector
- stop the element poll before invoking a throwing onSuccess

## [0.0.8](https://github.com/AndrewRedican/hyperfrontend/compare/29dc54d58c2b3c8b8dd35f7c546ebc6cd9191f6e...7b6cf80e7cfba3085e9d938d6298f5775f3401eb) - 2026-09-03

### Bug Fixes

- **tool-testing:** drain the timer queue and clamp a delay the way a real scheduler does

## [0.0.7](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...cc16961a470190848f71a7cce41f7377bc4511a4) - 2026-08-25

### Bug Fixes

- stop discarding the caller's onSuccess

## [0.0.6](https://github.com/AndrewRedican/hyperfrontend/compare/d96fee4d4d3a70178c8a01e5f2e2ae675fa23f37...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.0.5](https://github.com/AndrewRedican/hyperfrontend/compare/c8db08be8b183addd26caf81fdd17fb3693f296f...61a93d778d6b84915c51120f315e81b3a16fd67c) - 2026-04-06

### Bug Fixes

- use exclusively @hyperfrontend/logging api for logs

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-ui-utils@0.0.3...lib-ui-utils@0.0.4) - 2026-03-08


## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-ui-utils@0.0.2...lib-ui-utils@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-ui-utils:** correct package exports and main entrypoint ([39b9f3f](https://github.com/AndrewRedican/hyperfrontend/commit/39b9f3f339a433558e1f74bf761316ca7ae56cb1))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-ui-utils@0.0.1...lib-ui-utils@0.0.2) - 2026-02-26


## 0.0.1 - 2026-02-15

