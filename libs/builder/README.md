# @hyperfrontend/builder

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-builder.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-builder.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=builder">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=builder" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/builder">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/builder?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/builder">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fbuilder?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/builder">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/builder?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/builder/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/builder-manifest/hero.gif" alt="Two source entries feed the builder one at a time; each fans out into its ESM, CJS and declaration files, the root entry also into the minified IIFE and UMD bundles; then a package.json sheet rises and wires connect every file that landed to the exports, main, types and files keys it produced">
  </a>
</p>

Composable, vendor-neutral build toolkit for TypeScript libraries, JS bins, and Node SEA native binaries.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/builder/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fbuilder)

## What is @hyperfrontend/builder?

[`@hyperfrontend/builder`](https://www.hyperfrontend.dev/docs/libraries/builder/) is a build-time Node.js toolkit that turns a TypeScript
source tree into a publishable npm package. From a single declarative config it
discovers entry points, resolves externals, bundles each entry in isolation,
emits type declarations, synthesizes the output `package.json`, copies assets,
and, optionally, produces JavaScript bins and standalone Node SEA native
binaries.

It is **vendor-neutral**: nothing about a consumer's workspace (package naming,
which deps are first-party, hoist policy) is hard-coded. You inject those
opinions through predicates and config, so the same toolkit drives a leaf utility
library and a multi-entry framework alike.

### Key Features

- **[Multi-format output](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-BuildConfig)**: emit ESM, CJS, IIFE, and UMD bundles from one config; omit a format to skip it.
- **[Bins & native binaries](https://www.hyperfrontend.dev/docs/libraries/builder/bin/)**: synthesize JavaScript bins and cross-platform Node SEA native executables.
- **[Per-entry isolation](https://www.hyperfrontend.dev/docs/libraries/builder/architecture/#3-per-entry-isolation-keeps-peak-memory-bounded)**: each entry point bundles independently, keeping peak memory bounded on large graphs.
- **[Predicate-driven extensibility](https://www.hyperfrontend.dev/docs/libraries/builder/presets/)**: classify workspace packages, externals, and assets with plain functions instead of config DSLs.
- **[Self-contained packages](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/dependencies/)**: bundle first-party and third-party dependencies, with an additive post-emit pass that dedups shared internals into `_shared/` chunks.
- **[Composable phases](https://www.hyperfrontend.dev/docs/libraries/builder/architecture/#1-build-orchestrates-phases-compose)**: run the bundle, package, and bin phases together via [`build`](https://www.hyperfrontend.dev/docs/libraries/builder/#api-build), or drive each phase on its own.

### Architecture Highlights

- **[`build`](https://www.hyperfrontend.dev/docs/libraries/builder/#api-build) orchestrates; phases compose.** `build(config)` runs the full pipeline, while [`runBundlePhase`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/#api-runBundlePhase), [`runPackagePhase`](https://www.hyperfrontend.dev/docs/libraries/builder/package/#api-runPackagePhase), and [`runBinPhase`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/#api-runBinPhase) remain individually callable against a shared [`BuildContext`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-BuildContext) from [`createBuildContext`](https://www.hyperfrontend.dev/docs/libraries/builder/#api-createBuildContext).
- **Predicate extension model.** Externals, workspace membership, and asset conditions are expressed as predicates ([`byNames`](https://www.hyperfrontend.dev/docs/libraries/builder/presets/#api-byNames), [`byPrefix`](https://www.hyperfrontend.dev/docs/libraries/builder/presets/#api-byPrefix), or your own), keeping the core free of workspace-specific assumptions.
- **Memory-aware by design.** Per-entry bundling plus an opt-in memory monitor ([`createMemoryMonitor`](https://www.hyperfrontend.dev/docs/libraries/builder/memory/#api-createMemoryMonitor), [`recover`](https://www.hyperfrontend.dev/docs/libraries/builder/memory/#api-recover)) keep large builds inside constrained environments.

The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/builder/architecture/) covers the phase pipeline, the per-entry worker model, and the shared-internals dedup pass.

## Why Use @hyperfrontend/builder?

Most library bundlers assume one entry point, one format, and a fixed notion of
what is "external." [`@hyperfrontend/builder`](https://www.hyperfrontend.dev/docs/libraries/builder/) is built for monorepos that publish
many packages with shared internals and varied output needs:

- You need ESM **and** CJS **and** CDN-ready bundles from the same source.
- You ship CLIs and want native binaries without standing up a separate SEA pipeline.
- You want bundled, self-contained packages without forcing transitive installs on consumers.
- You want to script the build programmatically (or hand it to the `hf-build` CLI) without adopting a heavyweight, opinionated framework.

## Installation

```bash
npm install --save-dev @hyperfrontend/builder
```

That one install is all a build needs. TypeScript is a regular dependency rather than a peer, so declaration emit runs the compiler the builder itself depends on, and Rollup and its plugins ship inside the package; the published manifest declares no peer dependencies. The manifest declares Node.js 18 and npm 8, and the bundled Rollup plugins declare Node.js 20, so Node.js 20 or later is the recommended runtime.

## Quick Start

Drive the full pipeline programmatically with [`build`](https://www.hyperfrontend.dev/docs/libraries/builder/#api-build):

```typescript
import { build, byPrefix } from '@hyperfrontend/builder'

const result = await build({
  projectRoot: '/abs/path/to/libs/my-lib',
  workspaceRoot: '/abs/path/to/workspace',
  // Treat sibling workspace packages as first-party (bundled), everything else external.
  isWorkspacePackage: byPrefix('@my-scope/'),
  esm: { bundleWorkspaceDeps: true },
  cjs: { bundleWorkspaceDeps: true },
})

console.log(result)
```

Or build straight from a JSON config with the bundled CLI:

```bash
# Reads ./builder.config.json by default
hf-build --config ./builder.config.json --verbose
```

Need finer control? Compose the phases yourself:

```typescript
import { createBuildContext, runBundlePhase, runPackagePhase } from '@hyperfrontend/builder'

const ctx = createBuildContext(config)
await runBundlePhase(ctx, config)
await runPackagePhase(ctx, config, /* formats */ [])
```

## API Overview

Import the root for the pipeline, a sub-path to replace one step of it. Entry points are discovered from the `src/` layout and published where the source manifest's exports declare them; see [`discoverEntries`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/entries/#api-discoverEntries).

| Entry                                                                             | What it is                                                                                                                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [`@hyperfrontend/builder`](https://www.hyperfrontend.dev/docs/libraries/builder/) | The pipeline: [`build`](https://www.hyperfrontend.dev/docs/libraries/builder/#api-build), the context it resolves, the result it returns |
| [`/bundle`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/)         | Entry discovery, externals, per-entry Rollup dispatch, declarations and the shared-internals dedupe, each an entry of its own beneath it |
| [`/package`](https://www.hyperfrontend.dev/docs/libraries/builder/package/)       | The output manifest, assets and third-party licences, each an entry of its own beneath it                                                |
| [`/bin`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/)               | JavaScript bins and Node SEA native binaries                                                                                             |
| [`/memory`](https://www.hyperfrontend.dev/docs/libraries/builder/memory/)         | The opt-in memory monitor and the between-phases recovery primitive                                                                      |
| [`/presets`](https://www.hyperfrontend.dev/docs/libraries/builder/presets/)       | The predicate factories for classifying workspace packages                                                                               |
| [`/models`](https://www.hyperfrontend.dev/docs/libraries/builder/models/)         | The types every phase speaks: the config, the context, the result                                                                        |
| `hf-build`                                                                        | The command line, driving the pipeline from a JSON config                                                                                |

Every config field, phase signature and result type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/builder/#api-reference).

## Compatibility

[`@hyperfrontend/builder`](https://www.hyperfrontend.dev/docs/libraries/builder/) is a build-time tool for Node.js 18 or later and npm 8 or later; browsers, Web Workers and CDN runtimes are not targets. On Node.js 18 the Rollup worker that `hf-build` spawns receives the flag it needs for the `crypto` global; only a direct import of the [`/bundle/rollup/worker`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/rollup/worker/) entry on Node.js 18 has to pass `--experimental-global-webcrypto` itself.

<!-- hf:media start id="runtimes" scene="runtimes-builder" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later; not a target for evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ❌     |
| Web Workers     |    ❌     |

<!-- hf:media end -->

| Operating System | Supported |
| ---------------- | :-------: |
| Linux            |    ✅     |
| macOS            |    ✅     |
| Windows          |    ✅     |

### Output Formats

| Format | File        | Tree-Shakeable |
| ------ | ----------- | :------------: |
| ESM    | `index.mjs` |       ✅       |
| CJS    | `index.cjs` |       ❌       |

The package installs the `hf-build` command, and ships Node SEA native binaries alongside it for `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, and `win32-x64`.

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
