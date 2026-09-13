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

<!-- hf:media start id="banner" scene="banner-builder" asset="banner" alt="@hyperfrontend/builder" -->
<!-- hf:media end -->

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

[`typescript`](https://www.npmjs.com/package/typescript) is a regular dependency of the builder, not a peer: installing the
builder installs a compiler, and the published manifest declares no
[`peerDependencies`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-PackageJson-prop-peerDependencies) at all. Declaration emit spawns the workspace's own
`node_modules/.bin/tsc`, so when your project already depends on TypeScript that
is the compiler that runs. The builder is built against **TypeScript >= 5.9**.

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

The surface is the pipeline, in order. `build(config)` is the whole of it: it derives a [`BuildContext`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-BuildContext), runs the bundle, package and bin phases against it, and resolves
to a [`BuildResult`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-BuildResult) carrying per-format counts, the artifacts emitted and a wall-clock duration. Each phase stays callable on its own against a context you built
yourself, so [`runBundlePhase`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/#api-runBundlePhase),
[`runPackagePhase`](https://www.hyperfrontend.dev/docs/libraries/builder/package/#api-runPackagePhase) and
[`runBinPhase`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/#api-runBinPhase) are the seam for driving one step in isolation.

Most of that work is discovery rather than declaration, which is why the config stays small. Entry points come from the folder layout:
[`discoverEntries`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/entries/#api-discoverEntries) walks `src/`, and every directory holding an `index.ts`
becomes a published subpath, so adding an entry point is adding a folder. The seams that could have hard-coded a workspace are plain predicate functions instead:
[`isWorkspacePackage`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-BuildConfig-prop-isWorkspacePackage) is a `(name: string) => boolean`, with
[`byPrefix`](https://www.hyperfrontend.dev/docs/libraries/builder/presets/#api-byPrefix) and
[`byNames`](https://www.hyperfrontend.dev/docs/libraries/builder/presets/#api-byNames) as conveniences for the two common answers and a closure of your own just as
valid an argument.

What ships is measured rather than predicted. Each entry bundles in its own spawned child process, one per entry per format, and that isolation is what keeps peak
memory flat instead of climbing with the size of the graph; declarations are not synthesized in-process at all, since the builder spawns the workspace's own `tsc` and
flattens what it emits. The output `package.json` is reflected from what actually landed:
[`synthesizePackageJson`](https://www.hyperfrontend.dev/docs/libraries/builder/package/json/#api-synthesizePackageJson) writes [`exports`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-PackageJson-prop-exports), [`main`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-PackageJson-prop-main), [`module`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-PackageJson-prop-module) and [`types`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-PackageJson-prop-types)
from the formats that really emitted, and
[`reflectFilesAllowlist`](https://www.hyperfrontend.dev/docs/libraries/builder/package/json/#api-reflectFilesAllowlist) walks the finished output tree for [`files`](https://www.hyperfrontend.dev/docs/libraries/builder/models/#api-PackageJson-prop-files).

The sub-path entries expose that same machinery a level down, each for a different job: [`/bundle`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/) and its children for entry discovery, externals, rollup dispatch,
declarations and the shared-internals dedup pass; [`/package`](https://www.hyperfrontend.dev/docs/libraries/builder/package/) for the manifest, assets and third-party licenses; [`/bin`](https://www.hyperfrontend.dev/docs/libraries/builder/bin/) for JavaScript bins and Node SEA binaries;
[`/memory`](https://www.hyperfrontend.dev/docs/libraries/builder/memory/) for the build-memory monitor; [`/presets`](https://www.hyperfrontend.dev/docs/libraries/builder/presets/) for the predicate factories; and [`/models`](https://www.hyperfrontend.dev/docs/libraries/builder/models/) for the types all of them speak. Import the root when you want the
pipeline, a sub-path when you are replacing one step of it.

Every config field, phase signature and result type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/builder/#api-reference).

## Compatibility

[`@hyperfrontend/builder`](https://www.hyperfrontend.dev/docs/libraries/builder/) is a build-time tool that runs on Node.js. It is not
intended for browser, Web Worker, or CDN runtimes, and it needs npm 8 or later.

<!-- hf:media start id="runtimes" scene="runtimes-builder" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later; not a target for evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ❌     |
| Web Workers     |    ❌     |

<!-- hf:media end -->

### Output Formats

| Format | File           | Tree-Shakeable |
| ------ | -------------- | :------------: |
| ESM    | `index.esm.js` |       ✅       |
| CJS    | `index.cjs.js` |       ❌       |

The package installs the `hf-build` command, and ships Node SEA native binaries alongside it for `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, and `win32-x64`.

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
