# Changelog

All notable changes to this project will be documented in this file.

## [0.0.10](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Breaking Changes

- **BREAKING** **lib-builder:** stop loading the rollup worker from the bundle/rollup entry
- **BREAKING** **lib-builder:** emit index.mjs and index.cjs for module outputs
- **BREAKING** **lib-builder:** fail the build on a declared export it cannot publish

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
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
- **lib-testing:** reset a mock to the implementation it was created with
- **lib-testing:** type a fake child's pid as possibly undefined, as Node does
- **lib-testing:** deliver a late ResizeObserver notification with resizeLate
- **lib-testing:** add the browser entry for linked windows and a driven ResizeObserver
- **lib-testing:** add the process entry for terminal, stdio and child process stand-ins
- **lib-testing:** add the fs entry for self-cleaning temporary directories and fixture trees
- **lib-testing:** add clearMocks, resetMocks and restoreMocks to the test config
- **lib-testing:** add waitFor, waitUntil, flushPromises, sleep and createDeferred
- **lib-testing:** add createMock for typed, automatically mocked objects
- **lib-testing:** add jest.replaceProperty, jest.stubEnv and jest.stubGlobal
- **lib-builder:** inline dynamic imports into each library entry bundle
- **tool-package:** drop the e2e template's unknown rule directive
- **tool-package:** keep existing config when make-publishable re-runs
- **tool-package:** import make-publishable statically
- **tool-package:** scaffold libraries with the workspace lint config
- **lib-builder:** strip lint pragmas from bundled dependency code
- **tool-package:** typecheck each project's spec config alongside its library config
- **lib-testing:** read the alias file in one step instead of checking it first
- **tool-package:** scaffold e2e projects with an audit target and assertive spec names
- **tool-package:** scaffold libraries at 0.0.0 with a bare test target and runner config types
- **tool-package:** register a publishable library in ci, the root readme and the docs site
- **lib-testing:** promote the test runtime to the publishable @hyperfrontend/testing package
- **lib-builder:** build the bin descriptor's output dir natively
- **lib-builder:** keep resolved workspace dependency paths native
- **tool-package:** quote the tarball path when npm runs through the windows shell
- **lib-builder:** drop type diagnostics computed without path mappings
- **lib-builder:** retry report directory removal on transient windows locks
- **lib-builder:** keep core modules external without module.isBuiltin
- **BREAKING** **lib-builder:** stop loading the rollup worker from the bundle/rollup entry
- **lib-builder:** expose the crypto global to the rollup worker on node 18
- **BREAKING** **lib-builder:** emit index.mjs and index.cjs for module outputs
- **tool-package:** run the tsc entry script on node for typecheck
- **lib-builder:** run the tsc entry script on node for declaration emit
- **tool-package:** pass the e2e executor preloads as file urls
- **tool-package:** pass the test executor preload as a file url
- **tool-package:** report workspace-relative paths with posix separators
- **tool-package:** split text on crlf line endings
- **tool-package:** spawn npm through a shell on windows
- **lib-builder:** split worker stderr on crlf line endings
- **lib-builder:** rewrite only native separators to forward slashes
- **lib-builder:** walk up to package.json from native windows paths
- **lib-builder:** guard bundled deps against native windows paths
- **BREAKING** **lib-builder:** fail the build on a declared export it cannot publish
- **tool-package:** fold the compatibility matrix into the version commit
- **tool-package:** expose the builder clean option to projects
- **lib-builder:** clean only an owned output and add the clean option

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

