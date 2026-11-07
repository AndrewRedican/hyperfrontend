# Changelog

All notable changes to this project will be documented in this file.

## [3.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...998de01185d0dd0a73bb3c4fff5ca8d33b06703e) - 2026-11-07

### Dependency Updates

- **lib-workspace:** add the build, test, typecheck, e2e and publish executors
- **lib-testing:** install a packed consumer without trusting cached package metadata
- **lib-builder:** run the rollup worker on the main thread only

## [3.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Breaking Changes

- **BREAKING** **lib-builder:** stop loading the rollup worker from the bundle/rollup entry
- **BREAKING** **lib-builder:** emit index.mjs and index.cjs for module outputs
- **BREAKING** **lib-builder:** fail the build on a declared export it cannot publish

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
- **tool-package:** release a library the graph rebuilds
- **lib-json-utils:** keep the nested-quantifier probes linear on repeated parentheses
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
- **lib-cryptography:** return an ArrayBuffer-backed array from getRandomValues
- **lib-string-utils:** accept any ArrayBufferLike in arrayBufferToUtf8String
- **lib-string-utils:** return an ArrayBuffer-backed array from utf8StringToUint8Array
- **lib-immutable-api-utils:** return ArrayBuffer-backed views from the typed array factories
- **lib-builder:** fail the build on a declaration alias cycle between entries
- **lib-builder:** list every third-party package the output inlines in THIRD_PARTY_LICENSES.md
- **lib-builder:** reproduce dependency license texts in THIRD_PARTY_LICENSES.md
- **tool-package:** drop npm's silent flag from the version remedies
- **tool-package:** locate generator templates from the tree root
- **tool-package:** add a provenance option to the publish executor
- **tool-package:** locate the test runner from the workspace root
- **lib-json-utils:** rethrow what is not the parser's own failure
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
- **lib-json-utils:** add a json parser that keeps node positions
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
- **lib-cryptography:** read the web crypto subtle global at first use
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

## [3.0.1](https://github.com/AndrewRedican/hyperfrontend/compare/e25d9f8086e811f1bef3e27faa26c5154b35956d...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- drop every tracked process on destroy and cancel and latch a destroyed channel
- fire one cancel event per side and say whether the counterpart cancelled
- answer a connection request whose security slot carries no supported list

## [3.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/a638efc58ce78e9a84dd21992e7f5c675bd5e7f6...c2798e1479f78d5909adb098595846152a6f9350) - 2026-09-07

### Breaking Changes

- **BREAKING** SecurityProtocolVersion is 'none' | 'v3' | 'v4'; the protocol loader, the default protocol, shared key, and refresh-rate settings, the per-channel sharedKey and refreshRate, the security-negotiated event, SecurityTransport.isReady, and the securityReady channel state are removed; security-ready carries { protocol } and fires only after the counterpart's first sealed frame authenticates; security-error codes are the protocol's kebab-case verdicts; the peer dependency is @hyperfrontend/network-protocol 2.0.0.

### Features

- **BREAKING** confirm session keys inside the secure transport before security-ready

## [2.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/641f582281b0d20f2953e47aa7a815c210d916f2...7b6cf80e7cfba3085e9d938d6298f5775f3401eb) - 2026-09-03

### Features

- **tool-testing:** read a shorthand property, an unmock, and a workspace alias in a mock declaration

## [2.0.1](https://github.com/AndrewRedican/hyperfrontend/compare/d07b3add2620b9c6e9ddcf48e01571b8788a3bc7...bd296466c3f2a5e25643e7eeff8b1c4bf040e4fc) - 2026-08-04

### Bug Fixes

- omit the data key from payload-less sends so the security envelope accepts them

## [2.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/74110dd15151bfc8360ef4edcdb1086cb003c909...a830a2c5d3a9b7c9c9955a42823b49a4aaa4b3e8) - 2026-08-01

### Breaking Changes

- **BREAKING** open fires only after a counterpr completes the handshake; unanswered connects time out instead of opening

### Features

- report every handshake denial to the deciding side
- bind each session to the instance that opened it
- make the polite close a flush-then-confirm exchange
- gate the handshake on a contract compatibility rule
- activate security negotiation and transport attachment
- rebuild the security transport on the real wire protocol and export it
- **BREAKING** replace channel self-activation with the wire handshake, pinned origins, and connect deadline

### Bug Fixes

- schedule channel timers via immutable built-in copies
- fire the deny event on the denying responder once

## [1.1.3](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...47a37497608ac765af3efb30f0b5e01950bae425) - 2026-07-05

### Bug Fixes

- make importing the package side-effect free outside browsers
- deliver messages between real broker windows

## [1.1.2](https://github.com/AndrewRedican/hyperfrontend/compare/d96fee4d4d3a70178c8a01e5f2e2ae675fa23f37...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [1.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/a9185d9b783d7d8d51cc4ad91eb3178eba3e3930...61a93d778d6b84915c51120f315e81b3a16fd67c) - 2026-04-06

### Bug Fixes

- use @hyperfrontend/logging api exclusively for logging

## [1.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-nexus@1.0.1...lib-nexus@1.1.0) - 2026-03-16

### Other

- Version sync (no direct changes to this package)

## [1.0.1](https://github.com/AndrewRedican/hyperfrontend/compare/lib-nexus@1.0.0...lib-nexus@1.0.1) - 2026-03-08


## [1.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-nexus@0.1.1...lib-nexus@1.0.0) - 2026-03-02

### Bug Fixes

- **lib-nexus:** correct package exports ([721b795](https://github.com/AndrewRedican/hyperfrontend/commit/721b795849b571fdd8229cf3b38fad2699a36217))

### Code Refactoring

- **lib-nexus:** refactor internal workings of logging, and extend logging configuration options ([450a9a8](https://github.com/AndrewRedican/hyperfrontend/commit/450a9a80739c366755bd5f811f63ff83ec20290a))

### ⚠ BREAKING CHANGES

- **lib-nexus:** debug mode property is no longer available, instead there is a method to specify

## [0.1.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-nexus@0.1.2...lib-nexus@0.1.3) - 2026-02-27


## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/lib-nexus@0.1.0...lib-nexus@0.1.1) - 2026-02-26


## 0.1.0 - 2026-02-15

### Features

- **lib-nexus:** add simplified event subscription ([09dbfe4](https://github.com/AndrewRedican/hyperfrontend/commit/09dbfe47594f1aae765a9a94e5aa444c4cfd2051))
