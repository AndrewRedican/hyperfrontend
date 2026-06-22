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

Composable, vendor-neutral build toolkit for TypeScript libraries, JS bins, and Node SEA native binaries.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/builder/)

## What is @hyperfrontend/builder?

`@hyperfrontend/builder` is a build-time Node.js toolkit that turns a TypeScript
source tree into a publishable npm package. From a single declarative config it
discovers entry points, resolves externals, bundles each entry in isolation,
emits type declarations, synthesizes the output `package.json`, copies assets,
and — optionally — produces JavaScript bins and standalone Node SEA native
binaries.

It is **vendor-neutral**: nothing about a consumer's workspace (package naming,
which deps are first-party, hoist policy) is hard-coded. You inject those
opinions through predicates and config, so the same toolkit drives a leaf utility
library and a multi-entry framework alike.

### Key Features

- **Multi-format output** — emit ESM, CJS, IIFE, and UMD bundles from one config; omit a format to skip it.
- **Bins & native binaries** — synthesize JavaScript bins and cross-platform Node SEA native executables.
- **Per-entry isolation** — each entry point bundles independently, keeping peak memory bounded on large graphs.
- **Predicate-driven extensibility** — classify workspace packages, externals, and assets with plain functions instead of config DSLs.
- **Self-contained packages** — bundle first-party and third-party dependencies, with an additive post-emit pass that dedups shared internals into `_shared/` chunks.
- **Composable phases** — run the bundle, package, and bin phases together via `build`, or drive each phase on its own.

### Architecture Highlights

- **`build` orchestrates; phases compose.** `build(config)` runs the full pipeline, while `runBundlePhase`, `runPackagePhase`, and `runBinPhase` remain individually callable against a shared `BuildContext` from `createBuildContext`.
- **Predicate extension model.** Externals, workspace membership, and asset conditions are expressed as predicates (`byNames`, `byPrefix`, or your own), keeping the core free of workspace-specific assumptions.
- **Memory-aware by design.** Per-entry bundling plus an opt-in memory monitor (`createMemoryMonitor`, `recover`) keep large builds inside constrained environments.

## Why Use @hyperfrontend/builder?

Most library bundlers assume one entry point, one format, and a fixed notion of
what is "external." `@hyperfrontend/builder` is built for monorepos that publish
many packages with shared internals and varied output needs:

- You need ESM **and** CJS **and** CDN-ready bundles from the same source.
- You ship CLIs and want native binaries without standing up a separate SEA pipeline.
- You want bundled, self-contained packages without forcing transitive installs on consumers.
- You want to script the build programmatically — or hand it to the `hf-build` CLI — without adopting a heavyweight, opinionated framework.

## Installation

```bash
npm install --save-dev @hyperfrontend/builder
```

`typescript` is a required peer dependency — the builder drives declaration emit
through your project's TypeScript and is built against **TypeScript >= 5.9**.
Install it alongside the builder if your project does not already depend on it:

```bash
npm install --save-dev "typescript@>=5.9"
```

## Quick Start

Drive the full pipeline programmatically with `build`:

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

| Export                            | Description                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `build`                           | Run the full pipeline (bundle → package → bin) from a `BuildConfig`. |
| `createBuildContext`              | Derive the shared `BuildContext` used by the individual phases.      |
| `runBundlePhase`                  | Emit per-entry bundles and declarations for the configured formats.  |
| `runPackagePhase`                 | Synthesize the output `package.json`, assets, and license file.      |
| `runBinPhase`                     | Synthesize JavaScript bins and Node SEA native binaries.             |
| `createMemoryMonitor` / `recover` | Observe build memory pressure and recover from soft limits.          |
| `byNames` / `byPrefix`            | Preset predicate factories for classifying packages and externals.   |

Advanced primitives are available under sub-path entries — for example
`@hyperfrontend/builder/presets`, `@hyperfrontend/builder/bundle`,
`@hyperfrontend/builder/package`, and `@hyperfrontend/builder/bin`. See the
[documentation](https://www.hyperfrontend.dev/docs/libraries/builder/) for the
full surface.

## Compatibility

`@hyperfrontend/builder` is a build-time tool that runs on Node.js. It is not
intended for browser, Web Worker, or CDN runtimes.

| Environment       | Supported |
| ----------------- | --------- |
| Node.js >= 18     | ✅        |
| npm >= 8          | ✅        |
| TypeScript >= 5.9 | ✅        |
| Browser           | ❌        |

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
