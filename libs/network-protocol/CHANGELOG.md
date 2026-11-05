# Changelog

All notable changes to this project will be documented in this file.

## [2.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...a0f7b54607f0a998df303d4f46418c5b47e8dce8) - 2026-11-05

### Dependency Updates

- **tool-package:** release a library the graph rebuilds
- **lib-json-utils:** keep the nested-quantifier probes linear on repeated parentheses
- **tool-package:** declare operating systems in make-publishable output
- **tool-package:** quote the e2e and publish executors' npm spawns for cmd.exe
- **tool-package:** run the nx e2e suites one at a time on windows
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
- **tool-package:** scaffold e2e specs on the packed consumer
- **tool-package:** hand e2e suites the packed tarball path
- **lib-builder:** skip type checking in workers that drop diagnostics
- **lib-builder:** build browser bundles from one entry, refuse several

## [2.0.1](https://github.com/AndrewRedican/hyperfrontend/compare/e25d9f8086e811f1bef3e27faa26c5154b35956d...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- keep a queue draining after its handler rejects
- validate the drop handler when a channel is created

## [2.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/106ce4517092cdfa9f222b73d938d272c333d69b...c2798e1479f78d5909adb098595846152a6f9350) - 2026-09-07

### Breaking Changes

- **BREAKING** the browser/v1, browser/v2, node/v1, and node/v2 entries, the bundle/v1 and bundle/v2 builds, the password-keyed packet and data exports, and the six staged queues are removed; createChannel takes an options object with a session, ProtocolProvider receives the session, and Data no longer carries a key.

### Features

- **BREAKING** replace v1/v2 with the v3/v4 session

## [1.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...57e00623ade790f3ae8a2aa4f3b78316bd8b844d) - 2026-08-31

### Features

- Marked stable. No API changes since 0.2.1.

## [0.2.1](https://github.com/AndrewRedican/hyperfrontend/compare/a0ce00788db9fe1c2b1acf06dd59b2622cb1ed3f...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/a9185d9b783d7d8d51cc4ad91eb3178eba3e3930...8a05c80832de91cd61f8af064b417870ea1e3b01) - 2026-04-13

### Features

- **eslint-rules:** add lib-pkg-main-reexports

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.4...lib-network-protocol@0.1.0) - 2026-03-16

### Other

- Version sync (no direct changes to this package)

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.3...lib-network-protocol@0.0.4) - 2026-03-08

### Bug Fixes

- **lib-network-protocol:** correct package exports ([5b8ed3c](https://github.com/AndrewRedican/hyperfrontend/commit/5b8ed3c15a46716f973ab09907913091735160f2))

## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.2...lib-network-protocol@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-network-protocol:** correct package exports ([5b8ed3c](https://github.com/AndrewRedican/hyperfrontend/commit/5b8ed3c15a46716f973ab09907913091735160f2))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-network-protocol@0.0.1...lib-network-protocol@0.0.2) - 2026-02-26

### Bug Fixes

- **lib-network-protocol:** correct secondary entrypoints ([7092e3a](https://github.com/AndrewRedican/hyperfrontend/commit/7092e3af8a57829138e1c4dc38ed0f39e2e869d2))

## 0.0.1 - 2026-02-15

### Bug Fixes

- **lib-network-protocol:** fix imports ([5f6f6a9](https://github.com/AndrewRedican/hyperfrontend/commit/5f6f6a9b29f0ad148f9ad929ae5ca06d5da82299))
- **lib-network-protocol:** resolve stop/resume race condition in queue ([cc9d83f](https://github.com/AndrewRedican/hyperfrontend/commit/cc9d83fe014e9540c4033722b75ae868d321811a))
