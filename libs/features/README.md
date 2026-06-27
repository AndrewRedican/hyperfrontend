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

SDK, CLI, and dev server for building, embedding, and orchestrating hyperfrontend micro-frontend features.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/features/)

## What is @hyperfrontend/features?

`@hyperfrontend/features` is the batteries-included layer on top of [`@hyperfrontend/nexus`](https://www.hyperfrontend.dev/docs/libraries/nexus/) (cross-window messaging). Nexus handles the communication protocol; this package formalizes the frontend glue — iframe management, display modes, and lifecycle orchestration — needed to embed micro-frontend features in any host application.

It is organized into independent subpath entry points so consumers import only the surface they need.

### Key Features

- **Host SDK** (`/host`) - Embed features with a shell factory, display modes (embedded, dialog, popup, standalone), and open/close lifecycle.
- **Hostee SDK** (`/hostee`) - Initialize a feature app, declare its contract, and manage its lifecycle.
- **CLI** (`/cli`) - `init`, `build`, and `dev` commands driven by `feature.config.*`.
- **Dev server** (`/server`) - Static file server plus a debug UI for inspecting host/hostee message traffic.
- **Zero-config bundling** - Direct dependencies are bundled by `@hyperfrontend/builder`, so generated shells stay self-contained.

### Architecture Highlights

The package separates the host and hostee surfaces behind independent subpath exports and builds them on top of the Nexus messaging layer. For a full architectural overview — with diagrams of the host/hostee handshake, display modes, and shell generation — see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Why Use @hyperfrontend/features?

You get typed host and hostee SDKs, a CLI, and a dev server for composing micro-frontend features — and it works with any framework (React, Vue, Angular, vanilla JS) and build tool. Features build into self-contained shell packages with their dependencies bundled in, so a host installs one package and inherits no transitive install burden.

## Installation

```bash
npm install @hyperfrontend/features
```

## Quick Start

**In a feature app** (the hostee), declare a contract and connect to whatever host embeds it:

```typescript
import { createFeature } from '@hyperfrontend/features/hostee'

const feature = createFeature({
  name: 'clock',
  contract: { emitted: [{ type: 'tick' }], accepted: [{ type: 'set-timezone' }] },
})

await feature.ready()
feature.on('set-timezone', ({ tz }) => render(tz))
setInterval(() => feature.send('tick', Date.now()), 1000)
```

**In a host app**, build a shell and surface the feature in any display mode:

```typescript
import { createShell, DisplayMode } from '@hyperfrontend/features/host'

const shell = createShell({
  url: 'https://features.example.com/clock',
  container: '#clock-slot',
  displayMode: DisplayMode.Embedded,
})

shell.on('tick', (time) => console.log('feature said', time))
shell.open()
shell.send('set-timezone', { tz: 'UTC' })
```

**From the command line**, scaffold, build, and serve features with the bundled `hf` CLI:

```bash
npx @hyperfrontend/features init   # scaffold the hostee glue into an app
npx @hyperfrontend/features build  # generate + bundle a publishable shell package
npx @hyperfrontend/features dev     # serve apps with the debug UI
```

## API Overview

| Entry point                      | Purpose                                           | Status    |
| -------------------------------- | ------------------------------------------------- | --------- |
| `@hyperfrontend/features`        | Shared types, contract validation, `defineConfig` | Available |
| `@hyperfrontend/features/host`   | Host-side SDK (shell, display modes, lifecycle)   | Available |
| `@hyperfrontend/features/hostee` | Hostee-side SDK (feature init, lifecycle)         | Available |
| `@hyperfrontend/features/cli`    | CLI (`init`, `build`, `dev`) and `hf` bin         | Available |
| `@hyperfrontend/features/server` | Dev server and debug UI                           | Available |

> Using Nx? The package also ships a `feature` generator and `build`/`serve` executors at `@hyperfrontend/features/nx/*` to streamline integration in an Nx workspace.

## Compatibility

| Environment     | Supported |
| --------------- | --------- |
| Node.js >= 18   | ✅        |
| Modern Browsers | ✅        |
| Tree Shakeable  | ✅        |

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
