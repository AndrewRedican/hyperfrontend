# Changelog

All notable changes to this project will be documented in this file.

## [1.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/6cfa324760214038890a3a4212fed76a840fa38e...998de01185d0dd0a73bb3c4fff5ca8d33b06703e) - 2026-11-07

### Dependency Updates

- **lib-workspace:** add the build, test, typecheck, e2e and publish executors
- **lib-builder:** run the rollup worker on the main thread only

## [1.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/53020db1cc2866f0363c72c738ac1dcb671bfaf2...e1fedeaec2e4a890fb7767750298f48de3434cbe) - 2026-11-05

### Dependency Updates

- **tool-package:** let the version batch inherit the commit window
- **tool-package:** release a library the graph rebuilds
- **tool-package:** declare operating systems in make-publishable output
- **tool-package:** quote the e2e and publish executors' npm spawns for cmd.exe

## [1.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/41325ecf9b3f15f597cddadd5fbe6ab68f59eab7...1f922d33dad2e3cf7f8c525c5d99a69ac2508094) - 2026-11-01

### Bug Fixes

- accept any ArrayBufferLike in arrayBufferToUtf8String
- return an ArrayBuffer-backed array from utf8StringToUint8Array

## [1.0.1](https://github.com/AndrewRedican/hyperfrontend/compare/106ce4517092cdfa9f222b73d938d272c333d69b...adf0a4f77dece2be855e7ab88185a4fe84e7b16b) - 2026-09-14

### Bug Fixes

- copy decoded base64 bytes out of the shared buffer pool on node

## [1.0.0](https://github.com/AndrewRedican/hyperfrontend/compare/74110dd15151bfc8360ef4edcdb1086cb003c909...1c140227502e3657fc0a06b7eef34490cdc8b0f0) - 2026-08-31

### Features

- Marked stable. No API changes since 0.1.2.

## [0.1.2](https://github.com/AndrewRedican/hyperfrontend/compare/5f116abb8ba6355dfb283fa03b7481e5eb029480...47a37497608ac765af3efb30f0b5e01950bae425) - 2026-07-05

### Bug Fixes

- drop import-time fixture side effects from the prod graph

## [0.1.1](https://github.com/AndrewRedican/hyperfrontend/compare/a0ce00788db9fe1c2b1acf06dd59b2622cb1ed3f...466c0388c4cd516b9c704214140b4df1004098e6) - 2026-06-23

### Other

- **@hyperfrontend/workspace:** remove lib-builder and tool-package as implicit dependencies for all lib projects

## [0.1.0](https://github.com/AndrewRedican/hyperfrontend/compare/c8db08be8b183addd26caf81fdd17fb3693f296f...8a05c80832de91cd61f8af064b417870ea1e3b01) - 2026-04-13

### Features

- **eslint-rules:** add lib-pkg-main-reexports

## [0.0.4](https://github.com/AndrewRedican/hyperfrontend/compare/lib-string-utils@0.0.3...lib-string-utils@0.0.4) - 2026-03-08


## [0.0.3](https://github.com/AndrewRedican/hyperfrontend/compare/lib-string-utils@0.0.2...lib-string-utils@0.0.3) - 2026-03-02

### Bug Fixes

- **lib-string-utils:** correct package exports ([22b3a61](https://github.com/AndrewRedican/hyperfrontend/commit/22b3a6194e41faa38684aff3d8a9617420f08ed8))

## [0.0.2](https://github.com/AndrewRedican/hyperfrontend/compare/lib-string-utils@0.0.1...lib-string-utils@0.0.2) - 2026-02-26

### Bug Fixes

- **lib-string-utils:** define correct secondary entrypoints ([b71a865](https://github.com/AndrewRedican/hyperfrontend/commit/b71a8655947af996fc5ef926e397243eff379a6e))

## 0.0.1 - 2026-02-15

