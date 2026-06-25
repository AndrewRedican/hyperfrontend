# @hyperfrontend/features

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-features.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-features.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=features">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=features" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/features">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/features?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/features">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Ffeatures?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/features">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/features?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Vendor-agnostic SDK, CLI, and dev server for building, embedding, and orchestrating hyperfrontend micro-frontend features.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/features/)

## What is @hyperfrontend/features?

`@hyperfrontend/features` is the batteries-included, **vendor-agnostic** layer on top of [`@hyperfrontend/nexus`](https://www.hyperfrontend.dev/docs/libraries/nexus/) (cross-window messaging). Nexus handles the communication protocol; this package formalizes the frontend glue — iframe management, display modes, and lifecycle orchestration — needed to embed micro-frontend features in any host application, with **no Nx and no Nx workspace required**.

It is organized into independent subpath entry points so consumers import only the surface they need.

### Key Features

- **Host SDK** (`/host`) - Embed features with a shell factory, display modes (embedded, dialog, popup, standalone), and open/close lifecycle.
- **Hostee SDK** (`/hostee`) - Initialize a feature app, declare its contract, and manage its lifecycle.
- **CLI** (`/cli`) - `init`, `build`, and `dev` commands driven by `feature.config.*`.
- **Dev server** (`/server`) - Static file server plus a debug UI for inspecting host/hostee message traffic.
- **Zero-config bundling** - Direct dependencies are bundled by `@hyperfrontend/builder`, so generated shells stay self-contained.

### Architecture Highlights

The package separates the host and hostee surfaces behind independent subpath exports and builds them on top of the Nexus messaging layer. A full architectural overview (with diagrams) is published in `ARCHITECTURE.md` as each surface lands — see the status note below.

## Why Use @hyperfrontend/features?

Micro-frontend solutions must stay vendor-neutral — requiring a specific build tool or monorepo would defeat the purpose. `@hyperfrontend/features` is publishable and usable from any toolchain: consumers get typed host/hostee SDKs, a CLI, and a dev server without taking on Nx or any transitive install burden.

## Installation

```bash
npm install @hyperfrontend/features
```

## Quick Start

> **Status:** the public APIs for each subpath are being published progressively (see the roadmap status below). The entry points exist and the package imports cleanly today; usage examples are added as each surface ships.

```typescript
import {} from '@hyperfrontend/features/host' // host-side SDK
import {} from '@hyperfrontend/features/hostee' // hostee-side SDK
```

## API Overview

| Entry point                      | Purpose                                         | Status                            |
| -------------------------------- | ----------------------------------------------- | --------------------------------- |
| `@hyperfrontend/features`        | Package identity and shared surface             | Available                         |
| `@hyperfrontend/features/host`   | Host-side SDK (shell, display modes, lifecycle) | Reserved — lands in a 0.x release |
| `@hyperfrontend/features/hostee` | Hostee-side SDK (feature init, lifecycle)       | Reserved — lands in a 0.x release |
| `@hyperfrontend/features/cli`    | CLI (`init`, `build`, `dev`)                    | Reserved — lands in a 0.x release |
| `@hyperfrontend/features/server` | Dev server and debug UI                         | Reserved — lands in a 0.x release |

## Compatibility

| Environment     | Supported |
| --------------- | --------- |
| Node.js >= 18   | ✅        |
| Modern Browsers | ✅        |
| Tree Shakeable  | ✅        |

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
