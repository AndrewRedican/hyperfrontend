# Changelog

All notable changes to this project will be documented in this file.

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
