# 03 — Core SDK (Shared Types, Host, Hostee)

The primary deliverable: the host-side and hostee-side SDKs, plus the shared types they both depend on.

**Depends on** [01 — Reposition & Publishability](01-reposition-and-publishability.md) (the package must already live at `libs/features/` and be promoted). See the [index](README.md) for shared invariants.

**Consumes** (declare in `dependencies`, bundled by the builder):

- `@hyperfrontend/nexus` — broker API for host/hostee messaging. Consume it; do **not** reimplement channels.
- `@hyperfrontend/network-protocol` — the `none`/`v1`/`v2` security envelope.

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first** — this is the SDK's primary source, so the conventions matter most here. No enums (use `freeze(<const>{…})` + type derivation, which is exactly how `DisplayMode` below must be authored despite the illustrative `enum` shorthand), no direct built-in calls (use `@hyperfrontend/immutable-api-utils`), import/export ordering, required JSDoc on exported members, categorized comment prefixes, file-size limits, and one-assertion-per-test specs are all lint-enforced and fail CI (shared invariant 9). Fix violations preemptively.

---

## Architecture context

The host imports a generated shell package (see [04 — Shell Generation](04-shell-generation.md)); the feature app uses the hostee SDK directly. The shell bundles a subset of this SDK:

```
┌─────────────────────────────────────────────────────────────────────┐
│  SHELL PACKAGE (generated per feature)                              │
├─────────────────────────────────────────────────────────────────────┤
│  BUNDLED INSIDE index.js:                                            │
│  • Contract (inlined)                                                │
│  • Comms layer (nexus subset)                                       │
│  • Init/handshake protocol                                          │
│  • Display mode logic (embedded, dialog, popup, standalone)         │
│  • Lifecycle management                                             │
│  • Internal control plane (reserved __hf:* types on the channel)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## SDK decisions

| #   | Topic                | Decision                                                                             |
| --- | -------------------- | ------------------------------------------------------------------------------------ |
| 7   | Shell pattern        | Singleton (nexus caches broker instances)                                            |
| 8   | API typing           | Typed overloads generated from contract                                              |
| 9   | Display modes        | All 4 baked in (embedded, dialog, popup, standalone)                                 |
| 10  | Display mode plugins | Reserved for future (loading animations, etc.)                                       |
| 11  | Dialog defaults      | SDK provides overlay + close button; size is dynamic (decision 48), all customizable |
| 12  | Escape key           | Configurable (`closeOnEscape: boolean`, default true)                                |

## Security decisions (affect SDK + dev server)

| #   | Topic            | Decision                               |
| --- | ---------------- | -------------------------------------- |
| 26  | network-protocol | Bundled as direct dep in features      |
| 27  | Local default    | `protocol: 'none'` (opt-in security)   |
| 28  | Production       | Must pick v1 or v2 (enforced at build) |

The build-time enforcement of decision 28 lands in [05 — CLI](05-cli.md) (`build` command); the runtime selector is surfaced in [06 — Dev Server](06-dev-server.md)'s debug UI.

## Error-handling decisions

| #   | Topic            | Decision                                     |
| --- | ---------------- | -------------------------------------------- |
| 34  | Default behavior | Follow legacy pattern (show error UI)        |
| 35  | Customization    | Allow configuration (override error display) |
| 36  | Auto-retry       | No (emit error, let host decide)             |

## Liveness, sizing & API decisions

| #   | Topic                 | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 44  | Liveness heartbeat    | Baked-in and hidden: the feature auto-emits beats, the host monitors. Consumers never implement it. A consumer wanting their own heartbeat does so over the public contract (e.g. the Heartbeat demo's `ping`/`pong`) as a separate instance — distinct wire types from the baked-in beats.                                                                                                                                                                                                                 |
| 45  | Control transport     | nexus permits only one channel per window and forces the broker contract onto it, so a separate control channel is not possible. Internal traffic (beats, size announcements) rides the single secured channel as reserved `__hf:*` message types, merged into the contract by `withControlContract` and filtered out before reaching consumer handlers via `isControlType`. Diagnostics flow through `broker.logger` at `debug` level (seam for the plan-06 debug UI).                                     |
| 46  | Unresponsive handling | `onUnresponsive: 'emit' \| 'unmount' \| (info) => void`, default `'emit'` (extends decision 36 — emit `error`, host decides). The callback receives `{ shell, missedBeats, lastBeatAt, displayMode, close }`. Defaults: 1000 ms beat interval, 3 missed (~3 s) before unresponsive.                                                                                                                                                                                                                         |
| 47  | Embedded sizing       | Default `embedSizing: 'fill'` — the iframe fills its container via CSS `100%`, so no observation is needed. Opt-in `embedSizing: 'content'` makes the host apply the feature's announced content height to the iframe; the feature measures and announces its own size via `@hyperfrontend/ui-utils` `onElementResize`. Body reset is a **hostee** concern (the host cannot touch the cross-origin body): `FeatureOptions.resetBody` (default `true`) injects `margin/padding: 0` + transparent background. |
| 48  | Dynamic dialog size   | Dialog/popup size is derived from the viewport: a frozen config object exposed via getters with `coverage` (fraction of viewport height), `aspectRatio` (width = height × ratio), `maxCoverage`, and `fallbackWidth`/`fallbackHeight` used only when no viewport is measurable. Per-open `dialogWidth`/`dialogHeight` still override. Defaults: `coverage 0.6`, `aspectRatio 530/550`, `maxCoverage 0.9`, fallback `530×550`.                                                                               |
| 49  | Predicate getters     | No-argument predicates are exposed as `readonly` getter properties, not methods (e.g. `shell.isOpen`).                                                                                                                                                                                                                                                                                                                                                                                                      |
| 50  | Experience plugins    | Display-mode / experience plugins (animations, transitions) remain reserved (decision 10): the seam is the exported `ExperiencePlugin` / `ExperiencePluginContext` types; the SDK ships zero plugins and wires no `plugins` option yet.                                                                                                                                                                                                                                                                     |

---

## Phase 2.2 — Shared Types & Utilities

**Files to create:**

- `libs/features/src/index.ts`
- `libs/features/src/shared/types.ts`
- `libs/features/src/shared/contract.ts`
- `libs/features/src/shared/control.ts` — reserved `__hf:*` control types + `withControlContract` merge (decision 45)

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
  name?: string // feeds the broker-name heuristic + debug logs
  contract?: FeatureContract // replaces DEFAULT_CONTRACT for typed messaging
  displayMode?: DisplayMode
  url?: string
  closeOnEscape?: boolean
  // Embedded sizing (decision 47)
  embedSizing?: 'fill' | 'content' // default 'fill'
  resetBody?: boolean // hostee body reset, default true
  // Liveness (decision 46)
  onUnresponsive?: 'emit' | 'unmount' | ((info: UnresponsiveInfo) => void)
  // Dialog-specific — size is dynamic by default (decision 48); these override
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

// Config types + identity helpers (public, exported from the `.` entry).
// These give TS/JS configs type-checked authoring; see 05/06 for the loader
// and the JSON `$schema` counterpart. `defineConfig` is a PURE identity
// function for inference only — it is NOT the rescinded inline `defineFeature`.
export interface FeatureConfig {
  name: string
  version: string
  contract: string // path to *.contract.{json,ts,js}
}
export interface DevConfig {
  apps: Array<{ name: string; outputDir: string; port?: number }>
  debug?: { enabled?: boolean; messageLog?: boolean; securityView?: boolean }
}
export const defineConfig = (config: FeatureConfig): FeatureConfig => config
export const defineDevConfig = (config: DevConfig): DevConfig => config
```

> The `FeatureContract` shape is the same one the contract files and shell generator consume — see [04 — Shell Generation](04-shell-generation.md) for the on-disk `*.contract.json` schema and the type-generation step.

> **Config format & loading (decision 13).** `feature.config.*` / `hf-dev.config.*` may be `.json`, `.ts/.cts/.mts`, or `.js/.mjs/.cjs`. The tiered loader and full CLI/config flag parity live in [05 — CLI](05-cli.md); the SDK's only obligation here is to **export the `FeatureConfig`/`DevConfig` types and the `defineConfig`/`defineDevConfig` helpers** above, plus runtime validation of the resolved config object (shared with contract validation, decision 19). Inline-in-entry config is rescinded — definitions always come from a side-effect-free config file or flags.

**Verification:**

```bash
npx nx lint lib-features --fix
npx nx typecheck lib-features
```

---

## Phase 2.3 — Host SDK — Display Modes

**Files to create:**

- `libs/features/src/host/index.ts`
- `libs/features/src/host/types.ts`
- `libs/features/src/host/create-shell.ts`
- `libs/features/src/host/iframe.ts`
- `libs/features/src/host/lifecycle.ts`
- `libs/features/src/host/heartbeat.ts` — host-side beat watchdog (decision 46; unresponsive policy + `__hf:*` filtering live in `host/lifecycle.ts`)
- `libs/features/src/host/sizing.ts` — applies the feature-announced content height in `content` mode (decision 47)
- `libs/features/src/host/plugins.ts` — reserved experience-plugin seam types (decision 50)
- `libs/features/src/host/display-modes/embedded.ts`
- `libs/features/src/host/display-modes/dialog.ts`
- `libs/features/src/host/display-modes/popup.ts`
- `libs/features/src/host/display-modes/standalone.ts`
- `libs/features/src/host/display-modes/defaults.ts` — dynamic viewport-derived dialog/popup sizing (decision 48)

**Core API:**

```typescript
// libs/features/src/host/create-shell.ts
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
  readonly isOpen: boolean // getter (decision 49)
}
```

**Verification:**

```bash
npx nx test lib-features
npx nx lint lib-features --fix
npx nx typecheck lib-features
```

---

## Phase 2.4 — Hostee SDK

**Files to create:**

- `libs/features/src/hostee/index.ts`
- `libs/features/src/hostee/types.ts`
- `libs/features/src/hostee/create-feature.ts`
- `libs/features/src/hostee/lifecycle.ts`
- `libs/features/src/hostee/heartbeat.ts` — emits liveness beats (decision 44)
- `libs/features/src/hostee/sizing.ts` — body reset + content-size announcer (decision 47)

**Core API:**

```typescript
// libs/features/src/hostee/create-feature.ts
export function createFeature(options: FeatureOptions): FeatureHandle {
  // Creates broker via nexus (hostee side)
  // Opens the hidden control channel: starts the heartbeat, applies the body
  //   reset, and begins announcing content size (decisions 44–47)
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

> The heartbeat and body reset are **baked in and hidden** — they are not part of `FeatureHandle`. A consumer that wants its own heartbeat builds one over the public contract (the Heartbeat demo's `ping`/`pong`), which is a separate instance from the SDK's internal liveness (decision 44).

**Verification:**

```bash
npx nx test lib-features
npx nx lint lib-features --fix
npx nx typecheck lib-features
```

---

## SDK API Reference (target consumer experience)

This is the intended public surface the above phases build toward. It doubles as the spec for the typed overloads (decision 8) and the demo usage in [08 — Demos](08-demos.md).

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

## Final review (before marking this plan complete)

After the SDK code changes land, run the full gate with the Nx cache disabled as a final review-and-polish pass. Do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck lib-features --skip-nx-cache
npx nx lint lib-features --skip-nx-cache
npx nx test lib-features --skip-nx-cache
npx nx build lib-features --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- Decisions 10 / 50 (display-mode & experience plugins) are reserved; the SDK leaves a seam for them without building them now.
- The control-channel diagnostics (decision 45) surface in the dev server's debug UI as a dedicated liveness/control panel — that panel is a [06 — Dev Server](06-dev-server.md) follow-up; this plan only emits the structured `broker.logger` debug output it consumes.
- The exact mechanism for generating typed overloads from the contract (decision 8) is shared with [04 — Shell Generation](04-shell-generation.md)'s `generate-types.ts` — keep the two in sync.
