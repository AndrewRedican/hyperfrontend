# @hyperfrontend/features Implementation Plan

Comprehensive implementation plan for the `@hyperfrontend/features` package — the SDK, CLI, dev server, and shell generation system that enables the hyperfrontend microfrontend framework.

**Status**: Active — all prerequisite packages are published; core `@hyperfrontend/features` SDK is the next deliverable.

---

## Table of Contents

1. [Context](#context)
2. [Architecture Overview](#architecture-overview)
3. [Decisions Summary](#decisions-summary)
4. [Package Structure](#package-structure)
5. [Available Building Blocks](#available-building-blocks)
6. [Scaffolding & Automation](#scaffolding--automation)
7. [Implementation Phases](#implementation-phases)
8. [Demo Implementation](#demo-implementation)
9. [Deployment Architecture](#deployment-architecture)
10. [Deferred Items](#deferred-items)
11. [Documentation Cleanup](#documentation-cleanup-deferred)

---

## Context

The hyperfrontend project provides a microfrontend framework centered on `@hyperfrontend/nexus` (cross-window messaging protocol). However, nexus handles only the communication protocol — there is significant "frontend glue code" (iframe management, display modes, lifecycle orchestration) that exists in legacy references but is not yet formalized.

`@hyperfrontend/features` will be the batteries-included solution that:

- Provides a host-side SDK for embedding features
- Provides a hostee-side SDK for feature apps
- Generates shell packages that hosts import
- Includes a CLI for initialization, building, and development
- Ships a dev server with debug UI for testing host/hostee interactions
- Bundles all dependencies (nexus, network-protocol, etc.) for zero-config usage

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  FEATURE APP (e.g., Clock)                                          │
├─────────────────────────────────────────────────────────────────────┤
│  • Normal app (React, Vue, Angular, Vanilla JS)                     │
│  • Knows nothing about any host                                     │
│  • Declares: "I am a feature, here's my contract"                   │
│  • Uses @hyperfrontend/features/hostee SDK                          │
│                                                                      │
│  BUILD OUTPUT: @mycompany/clock-shell (npm-style package)           │
│  • Self-contained (zero runtime deps)                               │
│  • Contract inlined in bundle                                       │
│  • metadata.json for registry/humans                                │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           │ Host installs shell package
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  HOST APP                                                            │
├─────────────────────────────────────────────────────────────────────┤
│  • Any app that wants to embed features                             │
│  • Imports shell packages at build time                             │
│  • Uses shell API: shell.open(), shell.send(), shell.on()           │
│  • Controls display mode, container, lifecycle                      │
│  • Does NOT need @hyperfrontend/features as direct dep              │
└─────────────────────────────────────────────────────────────────────┘
```

### Shell Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  SHELL PACKAGE (generated per feature)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  @mycompany/clock-shell/                                             │
│  ├── package.json          # No dependencies (self-contained)       │
│  ├── dist/                                                           │
│  │   ├── index.js          # Shell SDK (bundled)                    │
│  │   ├── index.d.ts        # TypeScript declarations                │
│  │   └── index.js.map      # Source maps                            │
│  ├── metadata.json         # Contract + feature info (humans/registry)│
│  └── README.md             # Generated docs                          │
│                                                                      │
│  BUNDLED INSIDE index.js:                                            │
│  • Contract (inlined)                                                │
│  • Comms layer (nexus subset)                                       │
│  • Init/handshake protocol                                          │
│  • Display mode logic (embedded, dialog, popup, standalone)         │
│  • Lifecycle management                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Decisions Summary

### Core Decisions

| #   | Topic              | Decision                                                                                                            |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Location           | `libs/features/` (publishable library, not plugin)                                                                  |
| 2   | Entry points       | Sub-path exports: `/host`, `/hostee`, `/cli`, `/server`                                                             |
| 3   | CLI invocation     | `npx @hyperfrontend/features <command>`                                                                             |
| 4   | Bundling           | Direct deps (nexus, network-protocol, versioning) bundled                                                           |
| 5   | Framework adapters | None for now (leave room for future)                                                                                |
| 6   | Nx exclusivity     | Consumers do NOT need Nx; Nx stays an internal/optional-adapter concern. Use `@hyperfrontend/project-scope` for I/O |

### SDK Decisions

| #   | Topic                | Decision                                              |
| --- | -------------------- | ----------------------------------------------------- |
| 7   | Shell pattern        | Singleton (nexus caches broker instances)             |
| 8   | API typing           | Typed overloads generated from contract               |
| 9   | Display modes        | All 4 baked in (embedded, dialog, popup, standalone)  |
| 10  | Display mode plugins | Reserved for future (loading animations, etc.)        |
| 11  | Dialog defaults      | SDK provides overlay + close button, customizable     |
| 12  | Escape key           | Configurable (`closeOnEscape: boolean`, default true) |

### Configuration Decisions

| #   | Topic             | Decision                              |
| --- | ----------------- | ------------------------------------- |
| 13  | Config format     | JSON (`feature.config.json`)          |
| 14  | Feature config    | Minimal: name, version, contract path |
| 15  | Host config       | None — all programmatic in code       |
| 16  | Dev server config | JSON (`hf-dev.config.json`)           |

### Contract Decisions

| #   | Topic               | Decision                                         |
| --- | ------------------- | ------------------------------------------------ |
| 17  | Contract location   | Separate JSON file (`contracts/*.contract.json`) |
| 18  | Contract loading    | Bundled at build time (inlined in shell)         |
| 19  | Contract validation | Both build-time and runtime                      |
| 20  | Schema requirement  | Optional (type-only is fine)                     |

### Shell Generation Decisions

| #   | Topic               | Decision                                                |
| --- | ------------------- | ------------------------------------------------------- |
| 21  | Shell source        | Generated TypeScript (user can see/edit)                |
| 22  | Editable boundaries | Separate files (Vercel-style exports)                   |
| 23  | Protected core      | Handshake, channel creation, contract shape             |
| 24  | Customizable        | Display defaults, lifecycle hooks, message transformers |
| 25  | Generation timing   | Build-time (regenerated if contract changes)            |

### Security Decisions

| #   | Topic            | Decision                               |
| --- | ---------------- | -------------------------------------- |
| 26  | network-protocol | Bundled as direct dep in features      |
| 27  | Local default    | `protocol: 'none'` (opt-in security)   |
| 28  | Production       | Must pick v1 or v2 (enforced at build) |

### Dev Server Decisions

| #   | Topic          | Decision                                                  |
| --- | -------------- | --------------------------------------------------------- |
| 29  | Purpose        | Serve host + hostee together for integration testing      |
| 30  | Debug UI       | At root (`/`) of dev server                               |
| 31  | Debug features | Resize, display mode toggle, message log, encryption view |
| 32  | Multi-app      | Config-based orchestration + individual commands          |
| 33  | Asset serving  | Compiled output only (not framework-specific)             |

### Error Handling Decisions

| #   | Topic            | Decision                                     |
| --- | ---------------- | -------------------------------------------- |
| 34  | Default behavior | Follow legacy pattern (show error UI)        |
| 35  | Customization    | Allow configuration (override error display) |
| 36  | Auto-retry       | No (emit error, let host decide)             |

### Demo Decisions

| #   | Topic              | Decision                                          |
| --- | ------------------ | ------------------------------------------------- |
| 37  | Demo order         | Clock (Vue) → Heartbeat (React) → Views (Vanilla) |
| 38  | Demo host          | Docs site (`apps/docs-site/`)                     |
| 39  | Demo routes        | Next.js pages that embed features via shell       |
| 40  | Landing page       | Carousel with live embedded previews              |
| 41  | Shell packages     | Local workspace builds (not npm-published)        |
| 42  | Feature deployment | Railway (separate apps)                           |
| 43  | Docs deployment    | Vercel                                            |

---

## Package Structure

```
libs/features/
├── package.json
│   {
│     "name": "@hyperfrontend/features",
│     "version": "0.1.0",
│     "exports": {
│       ".": "./dist/index.js",
│       "./host": "./dist/sdk/host/index.js",
│       "./hostee": "./dist/sdk/hostee/index.js",
│       "./cli": "./dist/cli/index.js",
│       "./server": "./dist/server/index.js"
│     },
│     "bin": {
│       "hf": "./dist/cli/bin.js"
│     },
│     "dependencies": {
│       "@hyperfrontend/nexus": "...",
│       "@hyperfrontend/network-protocol": "...",
│       "@hyperfrontend/versioning": "...",
│       "@hyperfrontend/project-scope": "...",
│       "@hyperfrontend/json-utils": "..."
│     }
│   }
│
├── src/
│   ├── index.ts                     # Main entry (re-exports)
│   │
│   ├── sdk/
│   │   ├── host/                    # Host-side SDK
│   │   │   ├── create-shell.ts      # Factory for shell instances
│   │   │   ├── display-modes/
│   │   │   │   ├── embedded.ts      # Inline in container
│   │   │   │   ├── dialog.ts        # Modal with overlay
│   │   │   │   ├── popup.ts         # New browser window
│   │   │   │   ├── standalone.ts    # Full page
│   │   │   │   └── index.ts
│   │   │   ├── lifecycle.ts         # Open/close/destroy state machine
│   │   │   ├── iframe.ts            # Iframe creation utilities
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── hostee/                  # Hostee-side SDK
│   │   │   ├── create-feature.ts    # Feature initialization
│   │   │   ├── lifecycle.ts         # Feature lifecycle
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   └── shared/                  # Shared types, utilities
│   │       ├── types.ts             # Common interfaces
│   │       ├── contract.ts          # Contract utilities
│   │       └── index.ts
│   │
│   ├── cli/
│   │   ├── bin.ts                   # CLI entry point
│   │   ├── commands/
│   │   │   ├── init.ts              # Initialize feature or shell
│   │   │   ├── build.ts             # Build shell package
│   │   │   ├── dev.ts               # Start dev server
│   │   │   └── index.ts
│   │   ├── prompts.ts               # Interactive prompts (uses @hyperfrontend/questions)
│   │   └── index.ts
│   │
│   ├── server/
│   │   ├── dev-server.ts            # Static file server
│   │   ├── debug-ui/                # Debug interface
│   │   │   ├── index.html           # Debug page template
│   │   │   ├── controls.ts          # Display mode, resize controls
│   │   │   ├── message-log.ts       # Message traffic viewer
│   │   │   └── styles.ts            # Inline styles (no CSS files)
│   │   ├── config.ts                # Config file parsing
│   │   └── index.ts
│   │
│   ├── generators/                  # Code generation
│   │   ├── shell/
│   │   │   ├── templates/           # Shell code templates
│   │   │   │   ├── shell.core.ts.template
│   │   │   │   ├── shell.config.ts.template
│   │   │   │   └── shell.exports.ts.template
│   │   │   └── generate-shell.ts
│   │   ├── contract/
│   │   │   └── generate-types.ts    # Generate TS types from contract
│   │   ├── metadata/
│   │   │   └── generate-metadata.ts # Generate metadata.json
│   │   └── index.ts
│   │                                # NOTE: no @nx/devkit, no generators.json /
│   │                                # executors.json here — the core package is
│   │                                # vendor-agnostic. Nx support is a separate
│   │                                # opt-in package (see Phase 6).
│
├── README.md
├── ARCHITECTURE.md
└── CHANGELOG.md
```

---

## Available Building Blocks

Every runtime and tooling dependency `@hyperfrontend/features` needs is already published and consumable today. Build the SDK directly on top of them.

| Dependency                        | Used By          | Purpose             | What to consume                                                                                                                 |
| --------------------------------- | ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@hyperfrontend/nexus`            | SDK              | Messaging layer     | For host/hostee messaging, consume the broker API from `@hyperfrontend/nexus` rather than reimplementing channels.              |
| `@hyperfrontend/network-protocol` | SDK              | Security/encryption | For the `none`/`v1`/`v2` security envelope, consume `@hyperfrontend/network-protocol`.                                          |
| `@hyperfrontend/versioning`       | Shell generation | Version management  | For shell/contract version stamping and compatibility, prefer `@hyperfrontend/versioning`.                                      |
| `@hyperfrontend/project-scope`    | CLI/generators   | Project file I/O    | For all filesystem and workspace I/O, consume `@hyperfrontend/project-scope`; never touch `node:fs` directly.                   |
| `@hyperfrontend/json-utils`       | Config parsing   | JSON utilities      | For reading/validating `*.config.json` and contracts, prefer `@hyperfrontend/json-utils` (`libs/utils/json`).                   |
| `@hyperfrontend/questions`        | CLI              | Interactive prompts | For interactive CLI prompts, consume `@hyperfrontend/questions` rather than adding a third-party prompt lib.                    |
| `@hyperfrontend/builder`          | Build/bin        | Bundling + JS bins  | For building the package and synthesizing the CLI bin, consume `@hyperfrontend/builder` (`/bundle`, `/bin/script`, `/package`). |

> All of the above are published, non-private packages — declare them in `dependencies` and let the builder's dedupe/prune pass handle bundling. See `LIBRARY_COMPATIBILITY.md` for current versions.

---

## Scaffolding & Automation

Do not hand-roll project files that an existing generator or skill already produces. The repo's `@hyperfrontend/package` generators (all support `--dry-run`) and the matching Claude skills cover most of the structural work.

| Need                                               | Use this                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Relocate the project `plugins/` -> `libs/`         | `nx generate @hyperfrontend/package:move` (updates all references)                                   |
| Rename project `plugin-features` -> `features`     | `nx generate @hyperfrontend/package:rename`                                                          |
| Promote the relocated project to publishable       | `nx generate @hyperfrontend/package:make-publishable` (creates the E2E project + CI status workflow) |
| Scaffold a brand-new lib (opt-in adapter)          | `nx generate @hyperfrontend/package:library --publishable` (see the `library-generators` skill)      |
| package.json / project.json fields & entry points  | `library-package-config` skill                                                                       |
| Public exports, subpath exports, build targets     | `library-package-config` skill                                                                       |
| ESM/CJS/IIFE/UMD output verification + E2E project | `library-e2e-setup` skill                                                                            |
| CI path filters + library workflow                 | `library-ci-workflows` skill                                                                         |
| README / sub-module docs                           | `readme-docs` skill                                                                                  |
| ARCHITECTURE.md                                    | `architecture-docs` skill                                                                            |
| Coding conventions for any new source              | `coding` skill                                                                                       |

> `make-publishable` leaves **6 manual entries** (root README table, `ci-libraries.yml`, `ci-main.yml`, and three docs-site files). Budget for those — they are listed in the `library-generators` skill and are easy to miss.

### Parallel prerequisite — CLI/bin execution across package managers

This can proceed in parallel with Phase 2 and does **not** block the Phase 2.0 repositioning, but it **does** gate shipping a working `npx @hyperfrontend/features` CLI.

`@hyperfrontend/builder` already produces JS bin CLIs end-to-end: `buildJsBin` (`@hyperfrontend/builder/bin/script`) bundles per declared format, prepends the `#!/usr/bin/env node` shebang, appends the runner bootstrap footer, names outputs `.mjs`/`.js`/`.cjs.js`, and `chmod`s them to `0o755`; the package-json synthesizer emits the `bin` field with correct relative paths and adds the bin to the `files` allowlist. So shebang, file permissions, and bin metadata are covered in principle.

**Research goal:** confirm the produced package actually runs as a CLI under every target package manager:

- `npx @hyperfrontend/builder` / `npx @hyperfrontend/features`
- `pnpm dlx @hyperfrontend/builder` / `pnpm dlx @hyperfrontend/features`
- `yarn dlx ...` and Nx's own task/bin resolution

Verify, against a real packed tarball (`npm pack`) of `@hyperfrontend/builder`, that for npm, pnpm, Yarn, and Nx: the `bin` map, `files`/exports allowlist, shebang line, executable bit, and on-disk layout are all sufficient for `dlx`/`npx` resolution. If any package manager exposes a gap (e.g. missing executable bit after extraction, wrong `bin` key, ESM-shebang interop), fold the fix into `@hyperfrontend/builder` **before** `@hyperfrontend/features` depends on it for its CLI.

---

## Implementation Phases

### Phase 2: Core — @hyperfrontend/features SDK

#### 2.0 Reposition the existing project (out of `plugins/`, into a vendor-agnostic package)

The project we are building **already exists**: it is the `@hyperfrontend/features` project at `plugins/features/` (Nx project `plugin-features`, `private: true`, `0.0.0`). This is the same package — we are **not** creating a second one and we are **not** changing its name. What changes is its identity: today it is positioned as an `@nx/devkit` plugin (init/add generators, serve executor — still implementation-stub comments); going forward it is a **vendor-agnostic, publishable package** (host/hostee SDK + shell generator + CLI + dev server) that consumers can use with no Nx and no Nx workspace. Requiring Nx would defeat the purpose of a micro-frontend solution that must stay vendor-neutral.

> **Terminology change.** "Plugin(s)" no longer means "Nx plugin" here. From now on, **plugins are opt-in extensions that consumers of `@hyperfrontend/features` choose to add** (experience plugins, display-mode plugins, framework/Nx adapters). `@hyperfrontend/features` itself is a package, not a plugin, and must move out of the `plugins/` tree and out of every "Plugins" menu (see [Documentation Cleanup](#documentation-cleanup-deferred)).

**Chosen approach — relocate and reframe the same project, don't greenfield:**

1. **Move it into `libs/` and drop the Nx-plugin identity.** Use `nx generate @hyperfrontend/package:move --project=plugin-features --destination=libs/features` to relocate `plugins/features/` → `libs/features/` (the generator updates all references), then rename the Nx project to `features` with `nx generate @hyperfrontend/package:rename --project=plugin-features --newName=features`. Remove the `@nx/devkit` dependency, `generators.json`/`executors.json`, and the `generators`/`executors` package.json keys from the core package — the package no longer registers itself as an Nx plugin. This preserves the project's git history and its publish-ready README instead of discarding it.
2. **Promote to publishable** with `nx generate @hyperfrontend/package:make-publishable --project=features`, then complete the publishability checklist (Phase 2.1).
3. **Salvage the design intent** captured in the old init/add/serve stub comments (feature.config.json shape, contracts layout, dev playground) by folding it into the SDK's CLI (Phase 4) and dev server (Phase 5) — these are now plain APIs/commands, not Nx generators.
4. **Optional Nx adapter is opt-in only.** If Nx generators/executors are still wanted, they live as a separate, optional opt-in package — one of the new-sense "plugins" — that delegates to this SDK (Phase 6). The core package never depends on it.

This keeps the same package and name, preserves history, and converts identity rather than rewriting — while making vendor-agnostic the default and Nx strictly optional.

#### 2.1 Promote to a publishable package

The project already has its config files (moved in Phase 2.0). Promote it rather than re-authoring by hand:

```bash
nx generate @hyperfrontend/package:make-publishable --project=features
```

This adds the E2E project + CI status workflow and the publishable build target (plus the 6 manual entries noted in [Scaffolding & Automation](#scaffolding--automation)). Then apply the **publishability checklist** below before writing SDK code.

**Publishability checklist (repo conventions):**

- **Name & metadata:** package name `@hyperfrontend/features`, non-private, `license`, `description`, `funding`, `keywords`, `engines` — match the shape of `libs/builder/package.json`.
- **Exports & subpaths:** declare `.`, `./host`, `./hostee`, `./cli`, `./server` subpath exports; configure them via the `library-package-config` skill (do not hand-edit blindly — it has ESLint rules that enforce required fields).
- **CLI/bin:** declare the bin in the build config so `@hyperfrontend/builder` synthesizes the `bin` field, shebang, and `0o755` output. Gate on the CLI/bin research item above.
- **TypeScript declarations:** ensure `.d.ts` emission per entry point; bundled-dep declarations must be self-contained (no transitive install burden pushed onto consumers).
- **ESM/CJS output:** emit both ESM and CJS via the builder; declare formats per entry point and verify with the `library-e2e-setup` skill (ESM, CJS, IIFE/UMD where relevant).
- **Docs:** README via `readme-docs`, ARCHITECTURE.md via `architecture-docs`, `@example` blocks via `jsdoc-examples`.
- **Tests & E2E:** unit coverage meets the lib coverage gate; the generated E2E project asserts the packed package imports cleanly in every declared format and that the CLI bin executes under `npx`/`pnpm dlx`.
- **Build & boundary checks:** `nx build features` clean; verify Nx project boundaries/tags (no consumer-facing dep on `@hyperfrontend/features-nx`); run the dependency review so only intended packages land in `dependencies`.
- **Publish inspection:** `npm pack --dry-run` (or `nx run features:build` + inspect the output `package.json`/tarball) to confirm `files`, `exports`, `bin`, and bundled deps are exactly as intended before any real publish.

#### 2.2 Shared Types & Utilities

**Files to create:**

- `libs/features/src/index.ts`
- `libs/features/src/sdk/shared/types.ts`
- `libs/features/src/sdk/shared/contract.ts`
- `libs/features/src/sdk/shared/index.ts`

**Types to define:**

```typescript
// DisplayMode enum
export enum DisplayMode {
  Embedded = 'embedded',
  Dialog = 'dialog',
  Popup = 'popup',
  Standalone = 'standalone',
}

// Shell options interface
export interface ShellOptions {
  container: string | HTMLElement
  displayMode?: DisplayMode
  url?: string
  closeOnEscape?: boolean
  // Dialog-specific
  dialogWidth?: number
  dialogHeight?: number
  dialogOverlay?: boolean
  // Security
  protocol?: 'none' | 'v1' | 'v2'
  sharedKey?: string
}

// Feature options interface
export interface FeatureOptions {
  name: string
  contract: FeatureContract
}

// Contract interface
export interface FeatureContract {
  emitted: ActionDescription[]
  accepted: ActionDescription[]
}
```

**Verification:**

```bash
npx nx lint features --fix
npx nx typecheck features
```

#### 2.3 Host SDK — Display Modes

**Files to create:**

- `libs/features/src/sdk/host/index.ts`
- `libs/features/src/sdk/host/types.ts`
- `libs/features/src/sdk/host/create-shell.ts`
- `libs/features/src/sdk/host/iframe.ts`
- `libs/features/src/sdk/host/lifecycle.ts`
- `libs/features/src/sdk/host/display-modes/index.ts`
- `libs/features/src/sdk/host/display-modes/embedded.ts`
- `libs/features/src/sdk/host/display-modes/dialog.ts`
- `libs/features/src/sdk/host/display-modes/popup.ts`
- `libs/features/src/sdk/host/display-modes/standalone.ts`

**Core API:**

```typescript
// libs/features/src/sdk/host/create-shell.ts
export function createShell(options: ShellOptions): ShellHandle {
  // Creates broker via nexus
  // Returns handle with: open, close, destroy, send, on, isOpen
}

export interface ShellHandle {
  open(options: ShellOptions): void
  close(): void
  destroy(): void
  send(type: string, data?: unknown): void
  on(event: string, handler: (data: unknown) => void): () => void
  isOpen(): boolean
}
```

**Verification:**

```bash
npx nx test features
npx nx lint features --fix
npx nx typecheck features
```

#### 2.4 Hostee SDK

**Files to create:**

- `libs/features/src/sdk/hostee/index.ts`
- `libs/features/src/sdk/hostee/types.ts`
- `libs/features/src/sdk/hostee/create-feature.ts`
- `libs/features/src/sdk/hostee/lifecycle.ts`

**Core API:**

```typescript
// libs/features/src/sdk/hostee/create-feature.ts
export function createFeature(options: FeatureOptions): FeatureHandle {
  // Creates broker via nexus (hostee side)
  // Waits for connection from host
  // Returns handle with: send, on, ready, close
}

export interface FeatureHandle {
  send(type: string, data?: unknown): void
  on(event: string, handler: (data: unknown) => void): () => void
  ready(): Promise<void>
  close(): void
}
```

**Verification:**

```bash
npx nx test features
npx nx lint features --fix
npx nx typecheck features
```

---

### Phase 3: Shell Generation

#### 3.1 Shell Templates

**Files to create:**

- `libs/features/src/generators/shell/templates/shell.core.ts.template`
- `libs/features/src/generators/shell/templates/shell.config.ts.template`
- `libs/features/src/generators/shell/templates/shell.exports.ts.template`
- `libs/features/src/generators/shell/templates/metadata.json.template`

**Template structure:**

```typescript
// shell.core.ts.template (PROTECTED - regenerated on build)
// ═══════════════════════════════════════════════════════════════
// MAINFRAME — DO NOT REMOVE OR MODIFY THIS SECTION
// ═══════════════════════════════════════════════════════════════
import { createShell } from '@hyperfrontend/features/host';

const contract = <%= JSON.stringify(contract) %>;

export function __shellInit() {
  return createShell({ contract, url: '<%= featureUrl %>' });
}
// ═══════════════════════════════════════════════════════════════

// shell.config.ts.template (USER EDITABLE)
export const dialogOptions = {
  width: 530,
  height: 550,
  overlay: true,
  closeOnEscape: true
};

export function onConnected(shell) {
  // Custom logic after connection
}

export function onError(error) {
  // Custom error handling
}
```

#### 3.2 Shell Generator

**Files to create:**

- `libs/features/src/generators/shell/generate-shell.ts`
- `libs/features/src/generators/shell/index.ts`
- `libs/features/src/generators/contract/generate-types.ts`
- `libs/features/src/generators/metadata/generate-metadata.ts`
- `libs/features/src/generators/index.ts`

**Verification:**

```bash
npx nx test features
npx nx lint features --fix
npx nx typecheck features
```

---

### Phase 4: CLI

#### 4.1 CLI Commands

**Files to create:**

- `libs/features/src/cli/bin.ts`
- `libs/features/src/cli/index.ts`
- `libs/features/src/cli/commands/index.ts`
- `libs/features/src/cli/commands/init.ts`
- `libs/features/src/cli/commands/build.ts`
- `libs/features/src/cli/commands/dev.ts`
- `libs/features/src/cli/prompts.ts`

**CLI Commands:**

```bash
# Initialize a feature app
npx @hyperfrontend/features init
# Interactive prompts: name, contract path

# Build shell package
npx @hyperfrontend/features build
# Reads feature.config.json, generates shell, bundles

# Start dev server
npx @hyperfrontend/features dev
# Serves feature + debug UI
```

**Verification:**

```bash
npx nx test features
npx nx lint features --fix
npx nx typecheck features
```

---

### Phase 5: Dev Server

#### 5.1 Static Server

**Files to create:**

- `libs/features/src/server/index.ts`
- `libs/features/src/server/dev-server.ts`
- `libs/features/src/server/config.ts`

#### 5.2 Debug UI

**Files to create:**

- `libs/features/src/server/debug-ui/index.html`
- `libs/features/src/server/debug-ui/index.ts`
- `libs/features/src/server/debug-ui/controls.ts`
- `libs/features/src/server/debug-ui/message-log.ts`
- `libs/features/src/server/debug-ui/styles.ts`

**Debug UI Features:**

- Display mode switcher (embedded/dialog/popup/standalone)
- Resize controls (width/height inputs + drag handles)
- Message log (incoming/outgoing, raw/decrypted/pretty views)
- Security protocol selector (none/v1/v2)
- Connection status indicator

**Verification:**

```bash
npx nx test features
npx nx lint features --fix
npx nx typecheck features
```

---

### Phase 6: Nx Adapter (Optional, opt-in plugin)

This is an **opt-in plugin** in the new sense (see [Phase 2.0](#20-reposition-the-existing-project-out-of-plugins-into-a-vendor-agnostic-package)) — a convenience for teams that happen to use Nx, never a requirement. The core SDK and CLI work in any workspace without Nx, and `@hyperfrontend/features` must not depend on this package.

It lives as a **separate, new package** (e.g. `@hyperfrontend/features-nx`, scaffolded with `@hyperfrontend/package:library`) that wraps the published SDK. Port the design from the old `init`/`add` generators and `serve` executor (salvaged in Phase 2.0) into thin Nx generators/executors that delegate to the SDK (Phase 2) and CLI (Phase 4) — `build`/`dev` executors call the SDK build + dev server; `generators.json` / `executors.json` register the wrappers.

**Verification:**

```bash
npx nx test features-nx
npx nx lint features-nx --fix
npx nx typecheck features-nx
```

---

## Demo Implementation

### Phase 7: Clock Demo (Vue)

#### 7.1 Create Clock Feature App

**Files to create:**

- `apps/demos/clock/package.json`
- `apps/demos/clock/project.json`
- `apps/demos/clock/feature.config.json`
- `apps/demos/clock/contracts/clock.contract.json`
- `apps/demos/clock/src/main.ts`
- `apps/demos/clock/src/App.vue`
- `apps/demos/clock/src/clock.ts` (feature initialization)
- `apps/demos/clock/index.html`
- `apps/demos/clock/vite.config.ts`

**Contract:**

```json
{
  "name": "clock",
  "version": "1.0.0",
  "emitted": [
    { "type": "timeUpdated", "description": "Emitted every second with current time" },
    { "type": "timezoneChanged", "description": "Emitted when timezone changes" }
  ],
  "accepted": [
    { "type": "setTimezone", "description": "Set the clock timezone" },
    { "type": "setFormat", "description": "Set 12h or 24h format" }
  ]
}
```

#### 7.2 Generate Clock Shell

**Files generated (by features build):**

- `apps/demos/clock/shell/shell.core.ts`
- `apps/demos/clock/shell/shell.config.ts`
- `apps/demos/clock/shell/shell.exports.ts`
- `apps/demos/clock/shell/dist/index.js`
- `apps/demos/clock/shell/dist/index.d.ts`
- `apps/demos/clock/shell/metadata.json`
- `apps/demos/clock/shell/package.json`

**Verification:**

```bash
npx nx build clock
npx nx test clock
npx nx lint clock --fix
```

---

### Phase 8: Heartbeat Demo (React)

#### 8.1 Create Heartbeat Feature App

**Files to create:**

- `apps/demos/heartbeat/package.json`
- `apps/demos/heartbeat/project.json`
- `apps/demos/heartbeat/feature.config.json`
- `apps/demos/heartbeat/contracts/heartbeat.contract.json`
- `apps/demos/heartbeat/src/main.tsx`
- `apps/demos/heartbeat/src/App.tsx`
- `apps/demos/heartbeat/src/heartbeat.ts`
- `apps/demos/heartbeat/index.html`
- `apps/demos/heartbeat/vite.config.ts`

**Contract:**

```json
{
  "name": "heartbeat",
  "version": "1.0.0",
  "emitted": [
    { "type": "pong", "description": "Response to ping" },
    { "type": "status", "description": "Health status update" }
  ],
  "accepted": [{ "type": "ping", "description": "Health check request" }]
}
```

**Verification:**

```bash
npx nx build heartbeat
npx nx test heartbeat
npx nx lint heartbeat --fix
```

---

### Phase 9: Views Demo (Vanilla JS)

#### 9.1 Create Views Feature App

**Files to create:**

- `apps/demos/views/package.json`
- `apps/demos/views/project.json`
- `apps/demos/views/feature.config.json`
- `apps/demos/views/contracts/views.contract.json`
- `apps/demos/views/src/main.ts`
- `apps/demos/views/src/views.ts`
- `apps/demos/views/index.html`
- `apps/demos/views/vite.config.ts`

**Verification:**

```bash
npx nx build views
npx nx test views
npx nx lint views --fix
```

---

### Phase 10: Docs Site Integration

#### 10.1 Add Demo Shell Dependencies

**Files to edit:**

- `apps/docs-site/package.json` — Add workspace deps for demo shells

```json
{
  "dependencies": {
    "@hyperfrontend/demo-clock-shell": "workspace:*",
    "@hyperfrontend/demo-heartbeat-shell": "workspace:*",
    "@hyperfrontend/demo-views-shell": "workspace:*"
  }
}
```

#### 10.2 Create Demo Pages

**Files to create:**

- `apps/docs-site/src/app/demo/clock/page.tsx`
- `apps/docs-site/src/app/demo/heartbeat/page.tsx`
- `apps/docs-site/src/app/demo/views/page.tsx`

#### 10.3 Update Landing Page

**Files to edit:**

- `apps/docs-site/src/app/page.tsx` — Add demo carousel with live embeds

**Verification:**

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  VERCEL                                                              │
├─────────────────────────────────────────────────────────────────────┤
│  hyperfrontend.dev                                                   │
│  ├── /                    Landing (carousel embeds Railway features)│
│  ├── /docs/*              Documentation pages                        │
│  ├── /demo/clock          Shell page → embeds clock from Railway    │
│  ├── /demo/heartbeat      Shell page → embeds heartbeat from Railway│
│  └── /demo/views          Shell page → embeds views from Railway    │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           │ iframe src (feature URLs)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RAILWAY                                                             │
├─────────────────────────────────────────────────────────────────────┤
│  clock-demo.up.railway.app      ← Clock feature (Vue)                │
│  heartbeat-demo.up.railway.app  ← Heartbeat feature (React)          │
│  views-demo.up.railway.app      ← Views feature (Vanilla JS)         │
└─────────────────────────────────────────────────────────────────────┘
```

### CI/CD Configuration

**Files to create:**

- `.github/workflows/ci-lib-features.yml`
- `.github/workflows/deploy-demo-clock.yml`
- `.github/workflows/deploy-demo-heartbeat.yml`
- `.github/workflows/deploy-demo-views.yml`

---

## Deferred Items

The following items are explicitly deferred to future work:

| Item                                 | Reason                        | Priority |
| ------------------------------------ | ----------------------------- | -------- |
| Version negotiation at runtime       | Need more design              | Medium   |
| Auto-retry on errors                 | Keep v1 simple                | Low      |
| Experience plugins                   | Future extensibility          | Low      |
| Framework-specific adapters          | Leave room, don't build       | Low      |
| Web Component alternative to iframes | Experimental (55% confidence) | Low      |

---

## Documentation Cleanup (deferred)

Repositioning `@hyperfrontend/features` from "Nx plugin" to "vendor-agnostic package" (Phase 2.0) leaves stale "plugin" framing across user-facing docs. **Do this as a follow-up pass once the package has moved to `libs/features/`** — it is captured here so it is not lost, not done now. Two intertwined edits everywhere:

1. **Reclassify the package:** `@hyperfrontend/features` is a **package**, not an Nx plugin. Move it out of every "Plugins" menu/section and out of `/docs/plugins/*` routes into the normal package listing. Replace `npx nx add @hyperfrontend/features` / `npx nx g @hyperfrontend/features:*` install-and-usage copy with the vendor-agnostic install + `npx @hyperfrontend/features <command>` CLI flow.
2. **Redefine "plugins":** wherever docs describe "plugins" generically, they should now mean **opt-in extensions consumers add** (experience plugins, display-mode plugins, the optional Nx adapter) — not "Nx plugins shipped by the framework."

Known touch-points (verify before editing; line numbers drift):

| File                                                               | What to change                                                                                                                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                        | "Nx plugin helps you…" intro, the `npx nx add` / `npx nx g` quick-start, and the packages-table row (currently links to `plugins/features` + `/docs/plugins/features/`)          |
| `apps/docs-site/src/lib/content.ts`                                | Entry `name: 'Features Plugin'`, `category: 'plugin'`, `readmePath: 'plugins/features/README.md'`, `entryPoints` → reclassify to a package category + new `libs/features/` paths |
| `apps/docs-site/src/app/docs/libraries/libraries-page-content.tsx` | The `category: 'plugin'`, "Nx Plugin" section heading, `/docs/plugins/features` href, and "Nx plugin with generators and executors" description                                  |
| `apps/docs-site/src/app/docs/quick-start/page.tsx`                 | "Add the plugin" step and `npx nx add` / `npx nx g @hyperfrontend/features:*` snippets                                                                                           |
| `apps/docs-site/src/components/value-proposition.tsx`              | Copy-to-clipboard `npx nx add @hyperfrontend/features`                                                                                                                           |
| `apps/docs-site/src/components/breadcrumb.tsx`                     | `plugins: 'Plugins'` / `features:` breadcrumb labels                                                                                                                             |
| `apps/docs-site/src/lib/navigation.ts`                             | "Plugin navigation items" — drop `features` from plugin nav, add to package nav                                                                                                  |
| `apps/docs-site/src/lib/docs-loader.ts`                            | `plugins/<slug>/README.md` + `/docs/plugins/${slug}` resolution for `features`                                                                                                   |

---

## Config File Schemas

### feature.config.json

```json
{
  "$schema": "https://hyperfrontend.dev/schemas/feature.config.json",
  "name": "clock",
  "version": "1.0.0",
  "contract": "./contracts/clock.contract.json"
}
```

### hf-dev.config.json

```json
{
  "$schema": "https://hyperfrontend.dev/schemas/hf-dev.config.json",
  "apps": [
    {
      "name": "clock",
      "outputDir": "./dist",
      "port": 3000
    }
  ],
  "debug": {
    "enabled": true,
    "messageLog": true,
    "securityView": true
  }
}
```

### \*.contract.json

```json
{
  "name": "clock",
  "version": "1.0.0",
  "emitted": [
    {
      "type": "timeUpdated",
      "description": "Emitted every second with current time",
      "schema": {
        "type": "object",
        "properties": {
          "time": { "type": "number" },
          "timezone": { "type": "string" }
        },
        "required": ["time"]
      }
    }
  ],
  "accepted": [
    {
      "type": "setTimezone",
      "description": "Set the clock timezone",
      "schema": {
        "type": "object",
        "properties": {
          "tz": { "type": "string" }
        },
        "required": ["tz"]
      }
    }
  ]
}
```

---

## SDK API Reference

### Host Side (`@hyperfrontend/features/host`)

```typescript
import { createShell, DisplayMode } from '@hyperfrontend/features/host'
import clockContract from '@mycompany/clock-shell/contract'

// Create shell instance (singleton per feature)
const clock = createShell({
  name: 'clock',
  contract: clockContract,
  url: process.env.CLOCK_FEATURE_URL,
})

// Open in embedded mode
clock.open({
  container: '#clock-container',
  displayMode: DisplayMode.Embedded,
})

// Open as dialog
clock.open({
  displayMode: DisplayMode.Dialog,
  dialogWidth: 530,
  dialogHeight: 550,
  closeOnEscape: true,
})

// Send messages (typed from contract)
clock.send('setTimezone', { tz: 'America/New_York' })

// Listen for messages (typed from contract)
clock.on('timeUpdated', (data) => {
  console.log('Time:', data.time)
})

// Lifecycle
clock.on('open', () => console.log('Connected'))
clock.on('close', () => console.log('Disconnected'))
clock.on('error', (err) => console.error('Error:', err))

// Close and cleanup
clock.close()
clock.destroy()
```

### Hostee Side (`@hyperfrontend/features/hostee`)

```typescript
import { createFeature } from '@hyperfrontend/features/hostee'
import contract from './contracts/clock.contract.json'

// Initialize feature
const feature = createFeature({
  name: 'clock',
  contract,
})

// Wait for host connection
feature.ready().then(() => {
  console.log('Connected to host')

  // Start sending time updates
  setInterval(() => {
    feature.send('timeUpdated', {
      time: Date.now(),
      timezone: currentTimezone,
    })
  }, 1000)
})

// Listen for host messages
feature.on('setTimezone', (data) => {
  currentTimezone = data.tz
  feature.send('timezoneChanged', { tz: data.tz })
})

feature.on('setFormat', (data) => {
  timeFormat = data.format
})
```

---

## Next Implementation Path

All prerequisites are published and consumable (see [Available Building Blocks](#available-building-blocks)). Remaining work, starting from the current state:

1. **Phase 2.0 — Reposition the existing project**: move `@hyperfrontend/features` from `plugins/features/` to `libs/features/`, drop the `@nx/devkit` plugin identity, and keep the same name. Same package, converted to vendor-agnostic.
2. **Phase 2 — Core SDK**: promote it to publishable via `@hyperfrontend/package:make-publishable`, then build host/hostee SDKs against `@hyperfrontend/nexus` + `@hyperfrontend/network-protocol`. Apply the publishability checklist.
3. **Phases 3–5 — Shell generation, CLI, dev server**: CLI bin built with `@hyperfrontend/builder`; gate the published CLI on the [CLI/bin research](#parallel-prerequisite--clibin-execution-across-package-managers).
4. **Phase 6 — Optional Nx adapter (opt-in plugin)**: a separate package that wraps the SDK for Nx users. Consumers never need Nx.
5. **Phases 7–9 — Demos**: Clock (Vue) proves the architecture end-to-end; Heartbeat (React) and Views (Vanilla JS) validate the framework-agnostic claim.
6. **Phase 10 — Docs site integration**: embed the demo shells.
7. **Documentation cleanup**: reclassify `@hyperfrontend/features` from plugin to package across the root README and docs-site — see [Documentation Cleanup](#documentation-cleanup-deferred).
