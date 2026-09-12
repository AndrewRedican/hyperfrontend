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

<p align="center">
  <a href="https://www.hyperfrontend.dev/demos/#koi-pond">
    <img width="560" src="https://www.hyperfrontend.dev/media/koi-pond/hero-clip.gif" alt="Eight koi swimming in a single pond, each one rendered by a different framework app">
  </a>
</p>
<p align="center">
  <sub>Eight separate apps (React, Vue, Svelte, Solid, Preact, Lit, Angular, vanilla TS) composited into one continuous scene over this package. <a href="https://www.hyperfrontend.dev/demos/#koi-pond">Open the live pond</a>.</sub>
</p>

SDK, CLI, and dev server for building, embedding, and orchestrating hyperfrontend micro-frontend features.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/features/)

• 👉 See [**API reference**](https://www.hyperfrontend.dev/docs/libraries/features/#api-reference)

• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Ffeatures)

## What is @hyperfrontend/features?

Embedding another team's app inside your page usually means an iframe, a pile of `postMessage` conventions nobody wrote down, and a frame that never quite fits the space you gave it. `@hyperfrontend/features` turns that into a contract: the feature app declares what it sends, what it accepts, and which display modes it supports; the host picks a mode and gets a typed handle back. The messaging protocol underneath is [`@hyperfrontend/nexus`](https://www.hyperfrontend.dev/docs/libraries/nexus/), and this package adds everything around it: iframe management, display modes and sizing, the open/close lifecycle, and a CLI that packages a feature app into an installable shell.

```typescript
// In the feature app, from '@hyperfrontend/features/hostee'
const feature = createFeature({ name: 'checkout', contract })
await feature.ready()
feature.send('order-placed', { id: 'A-1094' })

// In the host app, from '@hyperfrontend/features/host'
const checkout = createShell({ modes: { dialog: mountDialog }, url: 'https://checkout.example.com' })
checkout.on('order-placed', (order) => showReceipt(order))
checkout.open({ displayMode: DisplayMode.Dialog })
```

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/features/architecture/">
    <img width="640" src="https://www.hyperfrontend.dev/media/feature-session/hero.gif" alt="A Host panel and a Feature panel joined by a wire, with each named message travelling across it as a dot and landing in a growing log below: three nexus handshake frames, then __hf:present carrying mode dialog and a 720 by 540 viewport, then a repeating __hf:beat, then a single order-placed message">
  </a>
</p>
<p align="center">
  <sub>Everything above the last line is the session being established for you; <code>order-placed</code> is the only message either app actually wrote.</sub>
</p>

It is organized into independent subpath entry points so consumers import only the surface they need.

### Key Features

- **Host SDK** (`/host`) - Embed features with a shell factory, display modes (embedded, dialog, popup, standalone), and open/close lifecycle.
- **Hostee SDK** (`/hostee`) - Initialize a feature app, declare its contract, and manage its lifecycle.
- **CLI** (`/cli`) - `init`, `build`, and `dev` commands driven by `feature.config.*`, plus `serve` for production static hosting.
- **Dev server** (`/server`) - Static file server plus a debug UI for inspecting host/hostee message traffic; the same core backs the `hf serve` production server.
- **Zero-config bundling** - Direct dependencies are bundled by `@hyperfrontend/builder`, so generated shells stay self-contained.

### Architecture Highlights

The package separates the host and hostee surfaces behind independent subpath exports and builds them on top of the Nexus messaging layer. The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/features/architecture/) diagrams the host/hostee handshake, the display modes, and how a shell is generated.

## Why Use @hyperfrontend/features?

You get typed host and hostee SDKs, a CLI, and a dev server for composing micro-frontend features, and it works with any framework (React, Vue, Angular, vanilla JS) and build tool. Features build into self-contained shell packages with their dependencies bundled in, so a host installs one package and inherits no transitive install burden.

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
import { builtInDisplayModes, createShell, DisplayMode } from '@hyperfrontend/features/host'

const shell = createShell({
  modes: builtInDisplayModes,
  url: 'https://features.example.com/clock',
  container: '#clock-slot',
  displayMode: DisplayMode.Embedded,
})

shell.on('tick', (time) => console.log('feature said', time))
shell.open()
shell.send('set-timezone', { tz: 'UTC' })
```

Presentation is host-controlled and contract-preconfigured: a feature declares the display modes it supports (`display.modes` in `feature.config.*`, plus per-mode defaults like fixed embedded dimensions or the dialog box footprint and position), the generated shell builds in exactly those modes, and the host picks one per open.

At runtime the SDK measures the host-side space and reports it to the feature as exact pixels (the initial size travels with the mode announcement itself), and frames stay hidden until the session opens. In dialog mode the feature draws its own dialog box inside a transparent full-viewport pane and backdrop/Escape dismissal is coordinated for you. The [host SDK docs](https://www.hyperfrontend.dev/docs/libraries/features/host/) cover the modes one by one.

Contract actions may carry a `required: true` flag on `accepted` entries, which denies the connection unless the counterpart emits that type. Unflagged actions never gate the connection, so adding actions to a contract stays backward compatible.

The SDK's own traffic (the heartbeat, the presentation announcements, dismiss signals, dirty state, and the request/response envelopes) rides the same channel under a reserved `__hf:` prefix and is filtered out before your handlers run. Your contract must not declare action types beginning with `__hf:`; everything the plane carries is listed in the [architecture guide](https://www.hyperfrontend.dev/docs/libraries/features/architecture/).

Both sides can opt into a sealed envelope: pass `protocol` (and, for `v4`, a `sharedKey`) to `createShell` and `createFeature`, and the two sides negotiate it during the connection handshake.

| `protocol`         | Session keys                                          | `sharedKey`                                                        | Defeats                                                              |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `'none'` (default) | None: product messages cross in plaintext             | Rejected: passing one throws                                       | Nothing                                                              |
| `'v3'`             | Agreed fresh over the wire, once per session          | Rejected: passing one throws                                       | Scripts that listen                                                  |
| `'v4'`             | Agreed fresh per session, bound to the pre-shared key | Required, 16 characters or more: selecting `v4` without one throws | Scripts that listen, and scripts that could speak to the counterpart |

Handshake frames stay plaintext while product messages (including sends queued before the handshake) leave sealed, and a plaintext product message arriving on a secured channel is dropped. Key agreement is paid once per session; each message then costs one AES-GCM operation, so many secured channels can run at once on one page.

Security is fail-closed: a counterpart that cannot run the selected protocol is denied, and a session the counterpart never confirms (a mismatched `v4` key, for instance) closes with `reason: 'security-unconfirmed'` after the connect timeout. A packet the envelope cannot protect or unwrap is discarded and surfaced on that side as an `error` event shaped `{ reason: 'security-error', message, code }`, so a message one side sent and the other never received is never silent.

A contract may carry a semver `version`, or `createFeature` can receive a `version` option that takes precedence over `contract.version`. Each side presents its version during the handshake, and incompatible cuts (a different major, or a different minor below `1.0.0`) are denied before the channel opens, surfacing as an `error` on both handles. A side without a version always passes the check, so unversioned peers keep connecting.

A refused handshake ends at once. Whichever gate refuses (contract, policy, version, or fail-closed security), the host destroys the mount and the feature's pending `ready()` rejects: a `deny` surfaces as an `error` carrying the gate's `reason`, and a `cancel` the counterpart sent after aborting at its own gates surfaces on the host as `error` with `reason: 'handshake-cancelled'`.

Contract entries with a `schema` are enforced on both ends: `send` validates the payload against the sender's own `emitted` schema and throws in the sender's frame before anything crosses the wire, while incoming messages are validated against the receiver's own `accepted` schema. An invalid payload is dropped and surfaced as an `error` event shaped `{ reason: 'invalid-payload', type, errors }`. Schema-less actions pass through unchanged.

What each of these controls is actually worth, and which parts of an integration's security remain the operator's job rather than the SDK's, is stated once, in the [Security Model](https://www.hyperfrontend.dev/docs/core-concepts/security).

**From the command line**, scaffold, build, and serve features with the bundled `hf` CLI:

```bash
# scaffold the hostee glue into an app
npx @hyperfrontend/features init
# generate and bundle a publishable shell package
npx @hyperfrontend/features build --protocol v4
# serve apps with the debug UI
npx @hyperfrontend/features dev
# serve a built site for production
npx @hyperfrontend/features serve --root dist
```

`build` requires `--protocol v3` or `--protocol v4`; an explicit `--protocol none` produces an open, unauthenticated shell and builds only together with `--allow-open`.

## API Overview

Two of the entry points are runtimes, one per side of the frame, and an app imports exactly one. `/host` gives a host page
[`createShell`](https://www.hyperfrontend.dev/docs/libraries/features/host/#api-createShell): hand it a feature URL and a map of display modes, get back a
`ShellHandle` to `open`, `send` to, listen `on` and `close`. `/hostee` gives a feature app
[`createFeature`](https://www.hyperfrontend.dev/docs/libraries/features/hostee/#api-createFeature): hand it the contract that app will speak, get back a
`FeatureHandle` of the same shape. Both return synchronously; the feature awaits `ready()`, and the host watches its shell's `open`, `close` and `error` events.

The root entry is the DOM-free one: the contract, config and payload types both runtimes share, the `defineConfig` helper a `feature.config.*` file exports, and
`validateContract` for checking one before it ever reaches a wire. Import it from build scripts, config files and Node tests, where reaching for `/host` or
`/hostee` would drag a browser runtime along.

The last two entry points are Node tooling, importable as modules because the `hf` bin is only a thin argv wrapper over them. `/cli` is `init`, `build`, `dev` and
`serve` as functions, for when a shell invocation will not do. `/server` is the machinery under two of those:
[`startDevServer`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-startDevServer) for the multi-app dev server and its traffic-inspecting debug
UI, and [`startStaticServer`](https://www.hyperfrontend.dev/docs/libraries/features/server/#api-startStaticServer) for production hosting.

What `build` emits is the part worth knowing: a feature becomes a self-contained shell package with its direct dependencies bundled in, so a host installs that one
package and inherits no transitive install burden. Nx workspaces reach the same tooling as plugin targets, through `init` and `feature` generators and `build` and
`serve` executors under the `nx/generators` and `nx/executors` subpaths; `nx add @hyperfrontend/features` installs the package and runs the `init` one for you.

Every option, handle, contract and payload type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/features/#api-reference).

## Compatibility

| Environment     | Supported |
| --------------- | --------- |
| Node.js >= 18   | ✅        |
| Modern Browsers | ✅        |

Support is per entry point. `/host` and `/hostee` are browser runtimes, `/cli`, `/server`, and `/generators` are Node-only, and the root entry is DOM-free and runs anywhere.

### Output Formats

| Format | File                              | Tree-Shakeable |
| ------ | --------------------------------- | :------------: |
| ESM    | `index.esm.js`                    |       ✅       |
| CJS    | `index.cjs.js`                    |       ❌       |
| IIFE   | `bundle/host/index.iife.min.js`   |       ❌       |
| UMD    | `bundle/host/index.umd.min.js`    |       ❌       |
| IIFE   | `bundle/hostee/index.iife.min.js` |       ❌       |
| UMD    | `bundle/hostee/index.umd.min.js`  |       ❌       |

**Global variables:** `HyperfrontendFeaturesHost`, `HyperfrontendFeaturesHostee`

The package also installs the `hf` command.

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
