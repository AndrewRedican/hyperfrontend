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

1. **Standalone core, isolated Nx adapter.** The package, CLI, and dev server have no build-tool dependency. The optional Nx generators and executors live in an isolated `/nx/*` adapter that the core never imports, so Nx integration can be added or ignored without touching the SDK.

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

6. **Pure generators, I/O at the edges.** Generators are pure `(config, contract, tree) => void` functions that write to a `@hyperfrontend/project-scope` VFS tree; all filesystem I/O, prompting, and commits live in the CLI — never in the generators or the SDK.

---

## Module Composition

| Module       | Subpath       | Responsibility                                                                                                                                                                |
| ------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared`     | `.`           | Contract types, contract/config/payload validation, `DisplayMode`, `SecurityProtocol`, control messages, the event emitter, and the `defineConfig`/`defineDevConfig` helpers. |
| `host`       | `/host`       | `createShell` factory, the four display modes, iframe/sizing utilities, heartbeat watchdog, and the experience-plugin seam.                                                   |
| `hostee`     | `/hostee`     | `createFeature` factory, host-window resolution, feature lifecycle, and heartbeat emission.                                                                                   |
| `cli`        | `/cli`        | `init`/`build`/`dev` command runners, the tiered `feature.config.*` / `hf-dev.config.*` loader, and CLI/flag parity; backs the `hf` bin.                                      |
| `generators` | `/generators` | Pure generators for the shell package, `metadata.json`, the write-once feature module, and contract `.d.ts` types.                                                            |
| `server`     | `/server`     | Static per-app hosting and the in-browser debug UI (display-mode, resize, message-log, security controls).                                                                    |
| `nx`         | `/nx/*`       | Optional Nx adapter — a `feature` generator and `build`/`serve` executors that delegate to the SDK. Zero `@nx/devkit` dependency.                                             |

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
    H->>F: send(action, data)  ·  validated against contract
    F->>H: send(action, data)  ·  validated against contract
    F-->>H: heartbeat beats
    Note over H: missed beats → UnresponsivePolicy<br/>(emit / unmount / callback)
    H->>F: close() / destroy() → channel disconnect + teardown
```

Opening is asynchronous and deadline-bounded: the channel activates only when the Nexus wire handshake completes, and sends issued before then queue and flush on open. If the counterpart never completes the handshake within the deadline (`openTimeoutMs` / `readyTimeoutMs`, default 10 s), the shell tears the mount down and emits `error` with `reason: 'open-timeout'`, and the feature's `ready()` rejects after emitting `error` with `reason: 'ready-timeout'`.

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
  on(event: string, handler: (payload: unknown) => void): () => void
  readonly isOpen: boolean
}

// Hostee: connect a feature app to whatever host embeds it.
function createFeature(options: FeatureOptions): FeatureHandle

interface FeatureHandle {
  send(type: string, data?: unknown): void
  on(event: string, handler: (payload: unknown) => void): () => void
  ready(): Promise<void>
  close(): void
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

- [README.md](./README.md) — installation, quick start, and the API overview.
- [`src/host/README.md`](./src/host/README.md) · [`src/hostee/README.md`](./src/hostee/README.md) · [`src/cli/README.md`](./src/cli/README.md) · [`src/server/README.md`](./src/server/README.md) · [`src/generators/README.md`](./src/generators/README.md) — per-surface reference.
- [`@hyperfrontend/nexus`](https://www.hyperfrontend.dev/docs/libraries/nexus/) — the messaging layer this package builds on.
