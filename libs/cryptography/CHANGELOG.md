# Changelog

All notable changes to this project will be documented in this file.

## [1.1.4](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...f7402da4043201d00015d4d70ab5fed39908a46c) - 2026-11-07

### Dependency Updates

- **lib-workspace:** print a channel header only above a line that shows
- **lib-workspace:** refuse a batch whose revisions git cannot compare
- **lib-workspace:** report usage mistakes without a stack trace
- **lib-workspace:** count a partial batch failure in the plural
- **lib-workspace:** restore the batch log level after a library run throws
- **lib-workspace:** accept a range of @hyperfrontend/testing as a peer
- **lib-workspace:** leave peer ranges alone when bumping dependents
- **lib-workspace:** ignore coverage output in the .gitignore the workspace generator writes
- **lib-workspace:** make the package publishable
- **lib-workspace:** join project paths portably in the version executors and the dependency reader
- **lib-workspace:** leave installed packages out of the file list whatever the repository ignores
- **lib-workspace:** keep the suites of an e2e project that exists before the library publishes
- **lib-workspace:** stamp the graph caches with the installed engine version
- **lib-builder:** run the rollup worker on the main thread only
- **lib-workspace:** name every bumped library in the batch commit subject
- **lib-workspace:** add the generators and the helpers they are built from
- **lib-workspace:** add a missing package to one manifest section when every fix applies
- **lib-workspace:** publish the projects rule family as the lint entry
- **lib-workspace:** add the version, version-check and version-batch executors
- **tool-package:** restore the tree as it stood when the batch fails
- **lib-workspace:** add the workspace graph, runner, hf and executors

## [1.1.3](https://github.com/AndrewRedican/hyperfrontend/compare/53020db1cc2866f0363c72c738ac1dcb671bfaf2...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
- **tool-package:** release a library the graph rebuilds
- **tool-package:** declare operating systems in make-publishable output
- **tool-package:** quote the e2e and publish executors' npm spawns for cmd.exe

## [1.1.2](https://github.com/AndrewRedican/hyperfrontend/compare/5d6aaa1c9353303f77b6ac186afba9720b948d84...1f922d33dad2e3cf7f8c525c5d99a69ac2508094) - 2026-11-01

### Bug Fixes

- return an ArrayBuffer-backed array from getRandomValues

## [1.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/e25d9f8086e811f1bef3e27faa26c5154b35956d...793105a4c3e18eaa043e6b7307f95ba143b9fdcf) - 2026-10-11

### Bug Fixes

- read the web crypto subtle global at first use

## [1.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/106ce4517092cdfa9f222b73d938d272c333d69b...c2798e1479f78d5909adb098595846152a6f9350) - 2026-09-07

### Features

- add key agreement, key expansion, AEAD seal/open, and password stretching

## [1.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...39baf5cffc59f35cf9909f4061aeebe90b867ae1) - 2026-08-31

### Features

- Marked stable. No API changes since 0.2.1.

## [0.2.1](https://github.com/AndrewRedican/hyperfrontend/compare/a0ce00788db9fe1c2b1acf06dd59b2622cb1ed3f...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/a9185d9b783d7d8d51cc4ad91eb3178eba3e3930...8a05c80832de91cd61f8af064b417870ea1e3b01) - 2026-04-13

### Features

- **eslint-rules:** add lib-pkg-main-reexports

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-cryptography@0.0.4...lib-cryptography@0.1.0) - 2026-03-16

### Other

- Version sync (no direct changes to this package)

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-cryptography@0.0.3...lib-cryptography@0.0.4) - 2026-03-08

### Bug Fixes

- **lib-cryptography:** correct package exports ([651fae9](https://github.com/AndrewRedican/hyperfrontend/commit/651fae94622e6300f6351216f3be342aaa9e4962))
- **lib-cryptography:** prevent runtime modification of security-sensitive objects ([4af1411](https://github.com/AndrewRedican/hyperfrontend/commit/4af14115c6128fc5939539282f49abf26723f9ac))

## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-cryptography@0.0.2...lib-cryptography@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-cryptography:** correct package exports ([651fae9](https://github.com/AndrewRedican/hyperfrontend/commit/651fae94622e6300f6351216f3be342aaa9e4962))
- **lib-cryptography:** prevent runtime modification of security-sensitive objects ([4af1411](https://github.com/AndrewRedican/hyperfrontend/commit/4af14115c6128fc5939539282f49abf26723f9ac))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-cryptography@0.0.1...lib-cryptography@0.0.2) - 2026-02-26


## 0.0.1 - 2026-02-15

### Other

- Initial release
