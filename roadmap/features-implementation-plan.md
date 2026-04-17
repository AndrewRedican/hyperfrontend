# @hyperfrontend/features Implementation Plan

Comprehensive implementation plan for the `@hyperfrontend/features` package — the SDK, CLI, dev server, and shell generation system that enables the hyperfrontend microfrontend framework.

**Date**: April 16, 2026
**Status**: Approved (Grill Session Complete)

---

## Table of Contents

1. [Context](#context)
2. [Architecture Overview](#architecture-overview)
3. [Decisions Summary](#decisions-summary)
4. [Package Structure](#package-structure)
5. [Dependencies](#dependencies)
6. [Implementation Phases](#implementation-phases)
7. [Demo Implementation](#demo-implementation)
8. [Deployment Architecture](#deployment-architecture)
9. [Deferred Items](#deferred-items)

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

| #   | Topic              | Decision                                                  |
| --- | ------------------ | --------------------------------------------------------- |
| 1   | Location           | `libs/features/` (publishable library, not plugin)        |
| 2   | Entry points       | Sub-path exports: `/host`, `/hostee`, `/cli`, `/server`   |
| 3   | CLI invocation     | `npx @hyperfrontend/features <command>`                   |
| 4   | Bundling           | Direct deps (nexus, network-protocol, versioning) bundled |
| 5   | Framework adapters | None for now (leave room for future)                      |
| 6   | Nx exclusivity     | NOT Nx-exclusive; use `@hyperfrontend/scope` for I/O      |

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
│       "@hyperfrontend/scope": "...",
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
│   │
│   └── nx/                          # Nx-specific adapters (optional)
│       ├── generators/
│       │   ├── init/
│       │   └── add/
│       ├── executors/
│       │   ├── build/
│       │   └── dev/
│       └── index.ts
│
├── generators.json                  # Nx generator manifest
├── executors.json                   # Nx executor manifest
├── README.md
├── ARCHITECTURE.md
└── CHANGELOG.md
```

---

## Dependencies

### Build Order (Blocking Dependencies)

```
Phase 0 (Existing - may need enhancements):
├── @hyperfrontend/scope            # Project I/O abstraction
├── @hyperfrontend/nexus            # Messaging protocol
├── @hyperfrontend/network-protocol # Security layer
├── @hyperfrontend/versioning       # Version management
└── @hyperfrontend/json-utils       # JSON utilities

Phase 1 (New - blocks features):
├── @hyperfrontend/questions        # Terminal prompts (blocks CLI)
└── @hyperfrontend/builder          # Build tooling (blocks CLI binary)

Phase 2 (Core):
└── @hyperfrontend/features         # This package
```

### Internal Dependencies of @hyperfrontend/features

| Dependency                        | Used By          | Purpose             |
| --------------------------------- | ---------------- | ------------------- |
| `@hyperfrontend/nexus`            | SDK              | Messaging layer     |
| `@hyperfrontend/network-protocol` | SDK              | Security/encryption |
| `@hyperfrontend/versioning`       | Shell generation | Version management  |
| `@hyperfrontend/scope`            | CLI/generators   | Project file I/O    |
| `@hyperfrontend/json-utils`       | Config parsing   | JSON utilities      |
| `@hyperfrontend/questions`        | CLI              | Interactive prompts |

---

## Implementation Phases

### Phase 0: Prerequisites

Ensure existing packages are ready:

**Files to verify:**

- [libs/nexus/src/index.ts](libs/nexus/src/index.ts) — Messaging API stable
- [libs/network-protocol/src/index.ts](libs/network-protocol/src/index.ts) — Security API stable
- [libs/versioning/src/index.ts](libs/versioning/src/index.ts) — Version utilities available
- [libs/project-scope/src/index.ts](libs/project-scope/src/index.ts) — File I/O abstraction

**Verification:**

```bash
npx nx test nexus
npx nx test network-protocol
npx nx test versioning
npx nx test project-scope
```

---

### Phase 1: Foundation — New Prerequisite Packages

#### 1.1 Create @hyperfrontend/questions

Terminal prompting library (enquirer-inspired).

**Files to create:**

- `libs/questions/package.json`
- `libs/questions/project.json`
- `libs/questions/src/index.ts`
- `libs/questions/src/prompts/text.ts`
- `libs/questions/src/prompts/select.ts`
- `libs/questions/src/prompts/confirm.ts`
- `libs/questions/src/prompts/multiselect.ts`
- `libs/questions/README.md`

**Verification:**

```bash
npx nx test questions
npx nx lint questions --fix
npx nx typecheck questions
```

#### 1.2 Create @hyperfrontend/builder

Build tooling with Node SEA compilation.

**Files to create:**

- `libs/builder/package.json`
- `libs/builder/project.json`
- `libs/builder/src/index.ts`
- `libs/builder/src/bundle/rollup.ts`
- `libs/builder/src/cli/node-sea.ts`
- `libs/builder/README.md`

**Verification:**

```bash
npx nx test builder
npx nx lint builder --fix
npx nx typecheck builder
```

---

### Phase 2: Core — @hyperfrontend/features SDK

#### 2.1 Create Package Scaffold

**Files to create:**

- `libs/features/package.json`
- `libs/features/project.json`
- `libs/features/tsconfig.json`
- `libs/features/tsconfig.lib.json`
- `libs/features/tsconfig.spec.json`
- `libs/features/eslint.config.cjs`
- `libs/features/jest.config.ts`
- `libs/features/README.md`

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

### Phase 6: Nx Adapters (Optional)

#### 6.1 Nx Generators

**Files to create:**

- `libs/features/src/nx/generators/init/generator.ts`
- `libs/features/src/nx/generators/init/schema.json`
- `libs/features/src/nx/generators/init/schema.d.ts`
- `libs/features/src/nx/executors/build/executor.ts`
- `libs/features/src/nx/executors/build/schema.json`
- `libs/features/src/nx/executors/dev/executor.ts`
- `libs/features/src/nx/executors/dev/schema.json`
- `libs/features/generators.json`
- `libs/features/executors.json`

**Verification:**

```bash
npx nx test features
npx nx lint features --fix
npx nx typecheck features
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
| `@hyperfrontend/builder` full scope  | Start with narrow MVP         | High     |
| `@hyperfrontend/questions`           | Blocking, but well-scoped     | High     |
| Experience plugins                   | Future extensibility          | Low      |
| `plugins/` directory rename          | Cosmetic                      | Low      |
| Framework-specific adapters          | Leave room, don't build       | Low      |
| Web Component alternative to iframes | Experimental (55% confidence) | Low      |

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

## Summary

This implementation plan captures all decisions from the grill session and provides a clear path forward:

1. **Phase 0-1**: Ensure prerequisites, create blocking packages (questions, builder)
2. **Phase 2-5**: Build core `@hyperfrontend/features` (SDK, generators, CLI, server)
3. **Phase 6**: Optional Nx adapters
4. **Phase 7-9**: Demo apps (Clock, Heartbeat, Views)
5. **Phase 10**: Docs site integration

The first demo (Clock) will prove the entire architecture end-to-end. Subsequent demos validate framework-agnostic claims.
