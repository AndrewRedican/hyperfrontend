# Architecture

`@hyperfrontend/features` is the batteries-included layer on top of [`@hyperfrontend/nexus`](https://www.hyperfrontend.dev/docs/libraries/nexus/). Nexus owns the cross-window messaging protocol; this package owns the frontend glue around it — iframe management, display modes, lifecycle orchestration, shell generation, a CLI, and a dev server — so a feature app and a host app can be developed independently and composed at runtime.

---

## System Overview

A **feature app** (the _hostee_) is a normal web app that declares a contract and connects through the hostee SDK. A **host app** builds a _shell_ that mounts the feature in a display mode and exchanges contract-validated messages with it over a Nexus channel. The CLI turns a feature app into a self-contained _shell package_ that any host installs; the dev server runs both sides locally with a debug UI.

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart TB
    subgraph Host["HOST APP — /host"]
        Shell["createShell()<br/>• display-mode mount<br/>• open/close/destroy<br/>• send / on"]
    end
    subgraph Hostee["FEATURE APP — /hostee"]
        Feature["createFeature()<br/>• declare contract<br/>• ready / close<br/>• send / on"]
    end
    subgraph Shared["SHARED CORE — /"]
        Core["• contract types + validation<br/>• DisplayMode / SecurityProtocol<br/>• control messages + event emitter"]
    end
    subgraph Tooling["TOOLING"]
        Cli["CLI — /cli<br/>init · build · dev"]
        Gen["generators<br/>shell · metadata · types"]
        Server["dev server — /server<br/>static hosting + debug UI"]
    end

    Shell <-->|"Nexus channel<br/>(postMessage + security envelope)"| Feature
    Shell --- Core
    Feature --- Core
    Cli --> Gen
    Cli --> Server
    Gen -->|"emits"| ShellPkg["self-contained<br/>shell package"]
    ShellPkg -.->|"host installs"| Shell
```

The host never needs `@hyperfrontend/features` as a direct dependency: it installs the generated shell package, which inlines everything it needs. The two sides only agree on a **contract** (the actions each emits and accepts).

---

## Design Principles

1. **Standalone core, isolated Nx adapter.** The package, CLI, and dev server have no build-tool dependency. The optional Nx generators and executors live in an isolated `/nx/*` adapter that the core never imports, so Nx integration can be added or ignored without touching the SDK. The adapter mirrors the subset of Nx's contracts it consumes structurally (`nx/model.ts`) — Nx constructs and passes its own tree and context at runtime — and the `init` generator stages workspace edits through that virtual tree, so `--dry-run` previews them.

   ```typescript
   // ✅ the core SDK
   import { createShell } from '@hyperfrontend/features/host'
   // ❌ the core never imports build-tool internals
   // import { …} from '@nx/devkit'
   ```

2. **Per-surface subpath isolation.** Host, hostee, CLI, and server are independent entry points so a consumer pulls in only what it uses and bundlers tree-shake the rest.

   ```typescript
   // ✅ a feature app ships only the hostee surface
   import { createFeature } from '@hyperfrontend/features/hostee'
   // ❌ never re-export the host/CLI/server surface from the hostee barrel
   ```

3. **Contract-validated messaging.** Every action a side emits or accepts is declared in a `FeatureContract`; the contract drives validation, the shell type generator, and the debug UI. The contract is the only coupling between host and feature. Unknown inbound types are dropped and logged, and only `accepted` entries flagged `required: true` gate the connection (the counterpart must emit them), so adding actions to a contract stays backward compatible.

4. **Self-contained generated shells.** `build` emits a shell package with **zero runtime dependencies** — the contract is inlined and direct deps are bundled — so a host installs one package and inherits no transitive install burden.

5. **Security is explicit.** The envelope defaults to `protocol: 'none'` for local development; production builds must opt into `v1` or `v2` (`@hyperfrontend/network-protocol`).

   ```typescript
   // ✅ production picks an envelope explicitly
   createShell({ url, container, protocol: 'v2', sharedKey })
   // ⚠️ 'none' is a local-only default
   ```

6. **Capability flows from the host, correct by construction.** The feature declares the Permissions-Policy features it needs (`permissions` in `feature.config.*`, baked into the generated shell and disclosed in `metadata.json`); the host applies them as the frame's `allow` attribute and can replace the list. Containment (`sandbox`) is host-decreed, never baked, and the two hazardous tokens are managed rather than configurable: `allow-scripts` is always granted (the feature runtime is JavaScript) and `allow-same-origin` only to cross-origin feature URLs — so a script-less frame and a sandbox-shedding same-origin frame cannot be expressed.

   ```typescript
   // ✅ delegation is reviewable, containment is the host's call
   shell.open({ permissions: ['fullscreen'], sandbox: { downloads: true } })
   // ❌ no raw token strings — the SDK owns the hazardous tokens
   ```

7. **Presentation is coordinated control — host-owned, contract-preconfigured.** The feature declares which display modes it supports and their per-mode defaults (`display` in `feature.config.*`); the build bakes the declaration into the generated shell, which is built from only the declared mounts (`createShell`'s explicit `modes` map) and narrows the generated types to the declared union — an undeclared mode is a compile error, a runtime throw, and absent from the bundle. At runtime the host picks the mode and is the single geometry authority: it announces the mode with the frame's initial dimensions over `__hf:present`, keeps the frame hidden until the session opens, and reports later size changes as exact pixels over `__hf:viewport`; the hostee SDK sizes its document to match and never announces geometry of its own. Dialog mode inverts the visuals, not the control: the host provides a full-viewport transparent pane, the feature draws the inner box (sized and positioned per the agreement) and backdrop, and dismiss interactions cross as `__hf:dismiss` for the host to apply its configured policy.

   ```typescript
   // ✅ a shell is built from exactly the declared modes
   createShell({ modes: { embedded: mountEmbedded, dialog: mountDialog }, ...options })
   // ❌ no hostee mode requests, no hostee-driven frame sizing
   ```

8. **Pure generators, I/O at the edges.** Generators are pure `(config, contract, tree) => void` functions that write to a `@hyperfrontend/project-scope` VFS tree; all filesystem I/O, prompting, and commits live in the CLI — never in the generators or the SDK.

---

## Module Composition

| Module       | Subpath       | Responsibility                                                                                                                                                                                                                                                                             |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shared`     | `.`           | Contract types, contract/config/display/payload validation, `DisplayMode`, `SecurityProtocol`, control messages, presentation payloads + size formulas, the event emitter, the channel-wiring core both sides connect and route through, and the `defineConfig`/`defineDevConfig` helpers. |
| `host`       | `/host`       | `createShell` factory (explicit `modes` map), the four display-mode mounts, iframe utilities, container measurement + viewport reporting, heartbeat watchdog, and the experience-plugin seam.                                                                                              |
| `hostee`     | `/hostee`     | `createFeature` factory, host-window resolution, presentation application (canvas sync, dialog layout, dismiss detection), feature lifecycle, and heartbeat emission.                                                                                                                      |
| `cli`        | `/cli`        | `init`/`build`/`dev` command runners, the tiered `feature.config.*` / `hf-dev.config.*` loader, and CLI/flag parity; backs the `hf` bin.                                                                                                                                                   |
| `generators` | `/generators` | Pure generators for the shell package, `metadata.json`, the write-once feature module, and contract `.d.ts` types.                                                                                                                                                                         |
| `server`     | `/server`     | Static per-app hosting and the in-browser debug UI (display-mode, resize, message-log, security controls).                                                                                                                                                                                 |
| `nx`         | `/nx/*`       | Optional Nx adapter — `init`/`feature` generators and `build`/`serve` executors (via the `/nx/generators` and `/nx/executors` entry points) that delegate to the SDK, using the consumer's `@nx/devkit` when present and built-in equivalents otherwise. Zero `@nx/devkit` dependency.     |

---

## Data Flow

Mounting a feature and exchanging messages:

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
sequenceDiagram
    participant H as Host (createShell)
    participant D as Display mode
    participant I as iframe / window
    participant F as Feature (createFeature)
    participant N as Nexus channel

    H->>D: open(options)
    D->>I: mount (embedded / dialog / popup / standalone)
    I->>F: load feature app
    F->>N: connect + advertise contract
    H->>N: connect + advertise contract
    N-->>F: channel open
    N-->>H: channel open
    F-->>H: "open" event · ready() resolves
    Note over H: frame revealed — hidden until now
    H->>F: __hf:present — display mode + initial size + dialog box geometry
    H->>F: __hf:viewport — size changes in exact px
    Note over F: SDK sizes html/body to match<br/>app author handles "resize"
    H->>F: send(action, data)  ·  validated against contract
    F->>H: send(action, data)  ·  validated against contract
    F-->>H: heartbeat beats · visibility reports
    F-->>H: __hf:dismiss (dialog) → close / "dismiss" event / ignored per policy
    Note over H: four liveness states<br/>(healthy / unobservable / suspect / gone)<br/>suspect → UnresponsivePolicy (emit / unmount / callback)
    H->>F: close() → "closing" notice (flush window)
    F-->>H: final sends, then acknowledgement
    Note over H,F: each side fires a single "close"
```

Opening is asynchronous and deadline-bounded: the channel activates only when the Nexus wire handshake completes, and sends issued before then queue and flush on open. If the counterpart never completes the handshake within the deadline (`openTimeoutMs` / `readyTimeoutMs`, default 10 s), the shell tears the mount down and emits `error` with `reason: 'open-timeout'`, and the feature's `ready()` rejects after emitting `error` with `reason: 'ready-timeout'`.

### The opening handshake

Nothing opens without the three-frame exchange, and every gate that can refuse a session runs inside it:

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
sequenceDiagram
    participant H as Host (createShell)
    participant F as Feature (createFeature)

    Note over H,F: Symmetric — either side may send REQUEST first.<br/>Simultaneous attempts resolve by a broker-id tie-break (lower id yields)
    H->>F: REQUEST — contract + version, security offer
    Note over F: Gates: contract validity · required actions ·<br/>security policy · version compatibility · fail-closed security
    F->>H: ACCEPT — contract + version, security answer
    Note over H: The same gates run on this side
    H->>F: OPEN
    Note over H,F: Security transports attach before the send queues flush,<br/>so pre-open sends leave encrypted
    F-->>F: "open" · ready() resolves
    H-->>H: "open" · frame revealed · queued sends flush
    Note over H,F: A refused gate emits a local "error" carrying the reason<br/>and sends DENY (or CANCEL) on to the counterpart
```

Handshake frames replay idempotently and re-send on a retry cadence until answered, so neither side depends on the other having booted first. Refusal is symmetric too: whichever side decides emits a local `error` carrying a machine-readable `reason`, so a host that turns a feature down is never left waiting on the channel it refused. One asymmetry is deliberate — a security-policy rejection tells the refused requester only that it was not accepted, since naming the gate would disclose how this side judges connections.

Liveness is judged in four states, not a boolean. The feature pulses a hidden beat and reports its page visibility; the host watchdog counts misses only while both pages are visible (`healthy`), pauses while either is hidden (`unobservable` — throttled timers make silence weak evidence), runs the `UnresponsivePolicy` once per `suspect` episode (a recovering beat returns to `healthy` and re-arms it), and reports `gone` once the session closes. Transitions surface as the shell's `status` event.

Teardown is polite by default: `close()` on either side proposes the close, the counterpart receives a `closing` event while the channel still delivers — its flush window for unsaved work — then acknowledges, and each side fires a single `close` (an unacknowledged close completes at a deadline). The feature can declare unsaved work with `setDirty(true)`; the host sees it as the `dirty-state` event and the `isDirty` flag and can take it into account before proposing a close. `destroy()` remains the impolite immediate teardown.

A feature that reloads itself ends its session without either side proposing it. The mount survives: the shell keeps the frame, its observers and its subscriptions, and re-announces `__hf:present` (re-measured) to the new document, which handshakes on the same channel. The consumer sees the session boundary as `close` with `{ reason: 'peer-reload' }` followed by a fresh `open` — pending requests reject, `isDirty` resets, and anything session-scoped has to be sent again.

---

## Display Modes

The feature declares which modes it supports; the host picks one per open. A shell is built from exactly the declared mounts, so an undeclared mode is a compile error, a runtime throw, and absent from the bundle.

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart TB
    Cfg["<b>feature.config.*</b> — display.modes<br/>first entry is the default mode"] --> Modes

    subgraph Modes["createShell({ modes }) — only these mounts ship"]
        direction LR
        E["<b>embedded</b><br/>frame inline in the host's container"]
        D["<b>dialog</b><br/>full-viewport transparent pane"]
        P["<b>popup</b><br/>separate browser window"]
        S["<b>standalone</b><br/>plain new tab"]
    end

    E --> Geo["Host measures, host reports<br/>__hf:present (mode + initial px)<br/>__hf:viewport (later changes)"]
    D --> Geo
    D --> Dis["Feature draws the inner box + backdrop<br/>__hf:dismiss on backdrop press / Escape<br/>host applies dialogBackdrop policy"]
    P --> Win["Browser window is authoritative<br/>no frame geometry crosses"]
    S --> Win
```

The two iframe modes are the ones with a geometry agreement, and it runs one way: the host measures its own container and reports exact pixels; the hostee sizes its document to match and announces nothing of its own. The windowed modes stay deliberately thin — once a popup is open the browser and the user own it, and standalone is a plain `_blank`.

---

## Shell Generation

`hf build` turns a feature project into a package a host installs and nothing else. The generators are pure functions over a VFS tree; the CLI owns every side effect.

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart LR
    subgraph Inputs["FEATURE PROJECT"]
        direction TB
        Cfg["feature.config.*<br/>name · version · url<br/>display · permissions · protocol"]
        Con["*.contract.{json,ts,js}"]
    end

    subgraph Gen["hf build — pure generators"]
        direction TB
        G1["entry source<br/>contract inlined · types narrowed<br/>to the declared modes"]
        G2["package.json<br/>no declared dependencies"]
        G3["README.md<br/>usage · baked protocol · permissions"]
        G4["metadata.json<br/>FeatureDescriptor"]
    end

    subgraph Out["PUBLISHABLE ARTIFACT"]
        direction TB
        Bundle["ESM + CJS bundle<br/>dependencies inlined"]
        Tar["npm pack → tarball"]
    end

    Cfg --> Gen
    Con --> Gen
    Gen --> Bundle --> Tar
    Tar -.->|"host installs one package"| HostApp["host app<br/>createFeatureShell()"]
```

What the build bakes becomes the shell's defaults, and the host may override all of them: the feature URL, the default display mode, the per-mode dimension defaults, the declared `permissions`, and the security protocol. The contract and the declared mode set are not defaults — they are applied after the host's options, so a shell always speaks its feature's contract and mounts only the modes that feature declared. `sandbox` is never baked — containment is the host's call alone. `metadata.json` restates identity, canonical version, URL, contract, modes, protocol, and permissions so a registry or reviewer can inspect a shell without unpacking the bundle.

---

## The Control Plane

Both sides share one channel. Product traffic is whatever the contract declares; everything the SDK needs for itself rides the same channel under a reserved `__hf:` prefix, is validated by the same contract machinery, and is filtered out before consumer handlers run. There is no privileged side channel — and because the prefix is reserved, a contract must not declare action types that begin with it.

| Type              | Direction     | Carries                                                                                                         |
| ----------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| `__hf:present`    | host → hostee | The display mode, the frame's initial dimensions, and the agreed dialog box geometry. First message after open. |
| `__hf:viewport`   | host → hostee | A later change to the frame's usable space, in exact pixels. Iframe modes only.                                 |
| `__hf:beat`       | hostee → host | The liveness pulse the watchdog counts.                                                                         |
| `__hf:visibility` | hostee → host | The feature page's visibility, so silence while hidden is not read as failure.                                  |
| `__hf:dirty`      | hostee → host | Whether the feature holds unsaved work (`setDirty`).                                                            |
| `__hf:dismiss`    | hostee → host | A backdrop press or in-frame Escape in dialog mode. A signal only — it tears nothing down.                      |
| `__hf:request`    | either        | A correlated request envelope.                                                                                  |
| `__hf:response`   | either        | The correlated answer to one request.                                                                           |

Requests are the one control type consumers use directly. An envelope pairs a response to its request by `correlationId` and stamps the sending side, so a peer discards the echoes of its own traffic. One handler answers each request type — registering a second for the same type throws — and every request carries a deadline, 30 s unless the caller passes `timeoutMs`. Requests still pending when the session ends reject rather than hanging, including across a peer reload.

### Assumptions the Session Model Rests On

These hold across the registry, the watchdog, and the control plane, so no single module can assert them:

- **One channel per counterpart window.** `addChannel` deduplicates by target window and returns the channel that already exists, discarding the name and every setting except security. A second `addChannel` against the same window therefore inherits the first one's configuration silently.
- **One broker per counterpart document.** A second broker inside the peer's document reads as a new incarnation and takes the session. That is the feature's own trust domain, not a boundary this SDK defends.
- **Each side's control handler claims its own types.** Control traffic a side does not claim falls through to the correlated request peer.
- **The feature starts beating within roughly three seconds of `open`.** The watchdog allows three missed beats at a one-second tick, which is what makes a slow first paint indistinguishable from a hung feature.
- **Contracts are plain JSON, and the feature owns its whole document.** The hostee SDK resets the body and sizes the document root; a feature that fights that ownership breaks the sizing and transparency agreements.

---

## Core Interfaces

```typescript
// Host: build a shell, mount a feature, exchange messages.
function createShell(options: ShellOptions): ShellHandle

interface ShellHandle {
  open(options?: Partial<ShellOptions>): void
  close(): void
  destroy(): void
  send(type: string, data?: unknown): void
  request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown>
  handle(type: string, handler: RequestHandler): () => void
  on(event: string, handler: (payload: unknown) => void): () => void
  readonly isOpen: boolean
  readonly isDirty: boolean
}

// Hostee: connect a feature app to whatever host embeds it.
function createFeature(options: FeatureOptions): FeatureHandle

interface FeatureHandle {
  send(type: string, data?: unknown): void
  request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown>
  handle(type: string, handler: RequestHandler): () => void
  on(event: string, handler: (payload: unknown) => void): () => void
  setDirty(isDirty: boolean): void
  ready(): Promise<void>
  close(): void
  readonly displayMode: DisplayMode | null
}

// The only coupling between the two sides.
interface FeatureContract {
  emitted: ActionDescription[]
  accepted: ActionDescription[]
}

type DisplayMode = 'embedded' | 'dialog' | 'popup' | 'standalone'
type SecurityProtocol = 'none' | 'v1' | 'v2'
```

---

## Links

- [Microfrontends from first principles](https://www.hyperfrontend.dev/articles/microfrontends-from-first-principles) — why the boundary is drawn here, derived from scratch. The canonical rationale for this design.
- [Security Model](https://www.hyperfrontend.dev/docs/core-concepts/security) — the trust model, the browser/protocol/operator split, and the status of every control.
- [README.md](./README.md) — installation, quick start, and the API overview.
- [`src/host/README.md`](./src/host/README.md) · [`src/hostee/README.md`](./src/hostee/README.md) · [`src/cli/README.md`](./src/cli/README.md) · [`src/server/README.md`](./src/server/README.md) · [`src/generators/README.md`](./src/generators/README.md) — per-surface reference.
- [`@hyperfrontend/nexus`](https://www.hyperfrontend.dev/docs/libraries/nexus/) — the messaging layer this package builds on.
