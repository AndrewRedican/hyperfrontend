# Hyperfrontend Master Context

**A Comprehensive Guide to the Past, Present, and Future of Hyperfrontend**

_Last Updated: February 3, 2026_

---

## Executive Summary

**Hyperfrontend** is a hybrid micro-frontend framework that enables live web applications to be embedded within host applications at runtime—complete with communication protocols, lifecycle management, and contract standards. The project addresses fundamental challenges in enterprise frontend architecture: deployment coordination, version thrashing, and legacy modernization.

This document serves as the **authoritative context** for understanding hyperfrontend's evolution, architecture, and vision. It connects the dots between legacy implementations, current modular libraries, and the future roadmap.

---

## Table of Contents

1. [The Origin Story](#the-origin-story)
2. [Core Philosophy](#core-philosophy)
3. [Architectural Evolution](#architectural-evolution)
4. [Current Architecture](#current-architecture)
5. [Library Composition](#library-composition)
6. [The Shell Pattern](#the-shell-pattern)
7. [Security Model](#security-model)
8. [Isomorphic Design](#isomorphic-design)
9. [Future Vision](#future-vision)
10. [How Everything Connects](#how-everything-connects)

---

## The Origin Story

### The Problem (2021)

Enterprise organizations faced a recurring challenge: how to compose applications from independently developed and deployed frontend systems. The landscape was plagued by:

- **Creative sprawl** of sub-optimal micro-frontend approaches
- **Build-time coupling** creating deployment bottlenecks
- **Version conflicts** between teams using different framework versions
- **No standardization** for cross-window communication

### The Solution: A Standard Messaging Foundation

The original messaging library was born to establish a foundational, standard micro-frontend framework. It introduced:

```
┌─────────────────────────────────────────────────────────────────┐
│                ORIGINAL IMPLEMENTATION (2021-2023)               │
│                   THE FOUNDATIONAL IMPLEMENTATION                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MessageBroker                                                   │
│  ├── TCP-like semantics with three-way handshake                │
│  ├── Process ID (PID) tracking for message correlation          │
│  ├── Singleton per window/context                               │
│  └── Channel registry using WeakMap                             │
│                                                                  │
│  MessageChannel                                                  │
│  ├── Bidirectional communication pipes                          │
│  ├── Connection lifecycle (connect → active → close)            │
│  ├── Message queueing before connection established             │
│  └── Event subscription system                                  │
│                                                                  │
│  Contract System                                                 │
│  ├── Emitted actions: what this window sends                    │
│  ├── Accepted actions: what this window receives                │
│  ├── JSON Schema validation at runtime                          │
│  └── Origin-based security policies                             │
│                                                                  │
│  Pub-Sub Architecture                                            │
│  ├── Event filters (open, close, cancel, deny, invalid)         │
│  ├── Message filters by type                                    │
│  └── Flux-pattern compatible (Redux, NgRx, etc.)                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Innovation: The Connector Pattern

Alongside the messaging library came the **connector** (now called "shell")—a companion application that:

- Ships as a **zero-dependency, self-contained bundle**
- Knows how to establish connections using the messaging protocol
- Contains "glue code" for frontend visual/style coordination
- Provides a fluent API for embedding features via iframe, popup, or tab

This pattern was proven in production through **email-status-views** (`_/legacy-shell-application-pattern`), a real Angular application deployed in enterprise CRM systems.

---

## Core Philosophy

### The Hyperfrontend Principles

1. **Runtime Integration, Not Build-Time**
   - Features are loaded and connected at runtime
   - No need to rebuild host when features update
   - Independent deployment cycles

2. **Contract-First Communication**
   - Every feature declares its communication interface
   - Emitted/accepted action schemas are explicit
   - Type safety at development time, validation at runtime

3. **Framework Agnosticism**
   - Features can use React, Angular, Vue, Svelte, or vanilla JS
   - Host applications can use any framework
   - The protocol is the common language

4. **Zero-Dependency Distribution**
   - Shell packages have no external dependencies
   - Can be consumed via npm or CDN `<script>` tag
   - Works with modern build systems or plain HTML

5. **Defense-in-Depth Security**
   - Optional multi-layered encryption
   - Time-based password rotation
   - Origin validation and contract enforcement

---

## Architectural Evolution

The project evolved from a monolithic library to a modular ecosystem:

```
2021-2023: ORIGIN ERA
│
├── Original messaging library created (monolithic)
│   └── All messaging, contracts, lifecycle in one package
│
├── email-status-views (pp-proto) created
│   └── Proves pattern in production CRM
│
└── Validates: "This architecture works at scale"

                            │
                            ▼

2024-2025: MODULARIZATION ERA
│
├── Hyperfrontend workspace created (Nx monorepo)
│
├── Decomposition begins:
│   ├── @hyperfrontend/cryptography   → Crypto primitives
│   ├── @hyperfrontend/network-protocol → Security layers
│   ├── @hyperfrontend/state-machine  → State management
│   ├── @hyperfrontend/logging        → Structured logging
│   ├── @hyperfrontend/web-worker     → Worker utilities
│   └── @hyperfrontend/utils/*        → Utility libraries
│
└── Foundation laid for next evolution

                            │
                            ▼

2026: INTEGRATION ERA (Current)
│
├── @hyperfrontend/nexus → Modern MessageBroker/Channel
│   └── Functional API, contract validation, security policies
│
├── @hyperfrontend/features → Nx plugin for automation
│   └── Auto-generate shells, contracts, integrations
│
└── Vision: One command to make any app a "feature"
```

---

## Current Architecture

### The Library Stack

Hyperfrontend is composed of specialized libraries that work together:

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  @hyperfrontend/features    │  Nx Plugin                        │
│  ─────────────────────────  │  • init generator: prime apps     │
│  AUTO-GENERATES SHELLS      │  • add generator: consume features│
│  AND INTEGRATIONS           │  • Shell project scaffolding      │
└────────────────────────────────────────────────────────────────┬┘
                                                                  │
┌─────────────────────────────────────────────────────────────────┤
│                       COMMUNICATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  @hyperfrontend/nexus       │  Core Messaging                   │
│  ─────────────────────────  │  • Broker-channel architecture    │
│  BROKER + CHANNEL +         │  • Contract validation            │
│  CONTRACTS + LIFECYCLE      │  • Lifecycle events               │
│                             │  • Origin-based security          │
└────────────────────────────────────────────────────────────────┬┘
                                                                  │
┌─────────────────────────────────────────────────────────────────┤
│                        SECURITY LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  @hyperfrontend/network-protocol  │  Secure Transport           │
│  ───────────────────────────────  │  • Dynamic key encryption   │
│  ENCRYPTION + OBFUSCATION +       │  • Time-based passwords     │
│  STAGED QUEUES + VALIDATION       │  • Packet obfuscation       │
│                                   │  • Message queueing         │
├───────────────────────────────────┼─────────────────────────────┤
│  @hyperfrontend/cryptography      │  Crypto Primitives          │
│  ───────────────────────────────  │  • AES-GCM encryption       │
│  ISOMORPHIC CRYPTO OPERATIONS     │  • PBKDF2 key derivation    │
│                                   │  • Vault storage            │
└────────────────────────────────────────────────────────────────┬┘
                                                                  │
┌─────────────────────────────────────────────────────────────────┤
│                       FOUNDATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  @hyperfrontend/state-machine   │  State management patterns    │
│  @hyperfrontend/logging         │  Structured logging           │
│  @hyperfrontend/web-worker      │  Worker utilities             │
│  @hyperfrontend/utils/*         │  Data, string, list, etc.     │
└─────────────────────────────────────────────────────────────────┘
```

### Project Inventory

| Project                | Type         | Purpose                                             |
| ---------------------- | ------------ | --------------------------------------------------- |
| `lib-nexus`            | Library      | Core broker-channel messaging with contracts        |
| `lib-network-protocol` | Library      | Secure, encrypted communication protocols           |
| `lib-cryptography`     | Library      | Cryptographic primitives (encrypt, hash, vault)     |
| `lib-state-machine`    | Library      | State management patterns                           |
| `lib-logging`          | Library      | Structured logging for all packages                 |
| `lib-web-worker`       | Library      | Web Worker abstractions                             |
| `lib-*-utils`          | Libraries    | Utility functions (data, string, list, time, etc.)  |
| `plugin-features`      | Nx Plugin    | Shell generation and feature automation             |
| `app-*`                | Applications | Demo frontends (React, Vue, Angular, Svelte, JS)    |
| `demo-*`               | Applications | Feature demonstrations (clock, chess, events, etc.) |

---

## Library Composition

### @hyperfrontend/nexus — The Heart of Communication

Nexus implements the modern evolution of the original MessageBroker/MessageChannel pattern:

```typescript
import { createBroker } from '@hyperfrontend/nexus'

// Define communication contract
const contract = {
  emitted: [
    {
      type: 'USER_ACTION',
      schema: {
        /* JSON Schema */
      },
    },
  ],
  accepted: [
    {
      type: 'DATA_UPDATE',
      schema: {
        /* JSON Schema */
      },
    },
  ],
}

// Create broker (singleton per context)
const broker = createBroker({
  name: 'host-app',
  contract,
  settings: {
    whitelist: ['https://feature.example.com'],
    debug: true,
  },
})

// Add channel to feature iframe
const channel = broker.addChannel('my-feature', featureIframe.contentWindow)

// Subscribe to lifecycle and messages
channel.on((event, data) => {
  switch (event) {
    case 'open':
      /* connection established */ break
    case 'close':
      /* graceful disconnect */ break
    case 'deny':
      /* connection rejected */ break
  }
})

channel.onMessage((message) => {
  console.log('Received:', message.type, message.data)
})

// Connect and communicate
channel.connect()
channel.send('CONFIG', { theme: 'dark' })
```

### @hyperfrontend/network-protocol — Defense in Depth

When security is paramount, the network-protocol provides multi-layered protection:

```
Message Flow (Outbound):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Plaintext  │ ──▶ │  Encryption  │ ──▶ │Serialization │ ──▶ │ Obfuscation  │
│    Packet    │     │    Queue     │     │    Queue     │     │    Queue     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                                       ▼
                                                              ┌──────────────┐
                                                              │  Transport   │
                                                              │ (postMessage)│
                                                              └──────────────┘

Message Flow (Inbound):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Received   │ ──▶ │Deobfuscation │ ──▶ │Deserialization│ ──▶ │  Decryption  │
│    Packet    │     │    Queue     │     │    Queue     │     │    Queue     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                                       ▼
                                                              ┌──────────────┐
                                                              │  Plaintext   │
                                                              │   Handler    │
                                                              └──────────────┘
```

Security features:

- **Dynamic key encryption**: Keys rotate per message or time interval
- **Time-based password rotation**: Synchronized across endpoints via UTC
- **Packet obfuscation**: Makes ciphertext unrecognizable as encrypted data
- **Clock skew handling**: Tries ±1 time windows automatically

### @hyperfrontend/cryptography — Isomorphic Crypto

The cryptography library provides identical APIs for browser and Node.js:

```typescript
// Browser
import { encrypt, decrypt, createVault, getTimeBasedPasswords } from '@hyperfrontend/cryptography/browser'

// Node.js
import { encrypt, decrypt, createVault, getTimeBasedPasswords } from '@hyperfrontend/cryptography/node'

// Same API, platform-optimized implementation
const encrypted = await encrypt('sensitive data', 'password')
const decrypted = await decrypt(encrypted, 'password')
```

---

## The Shell Pattern

### Evolution: From Manual Connector to Auto-Generated Shell

**Legacy Approach (pre-2024):**

Developers hand-wrote ~300 lines of boilerplate per feature:

```typescript
// Manual connector for each feature
export class EmailStatusConnector {
  private broker: MessageBroker
  private channel: MessageChannel
  private iframe: HTMLIFrameElement

  constructor(appName: string, pluginName: string) {
    this.broker = broker(appName, contract)
  }

  open(viewMode: ViewMode, selector?: string): Connector {
    // Manual iframe creation
    // Manual channel setup
    // Manual lifecycle handling
    // ... 200+ more lines
  }

  setEnvironment(env: TargetEnvironment): Connector {
    /* ... */
  }
  setAccountKey(key: string): Connector {
    /* ... */
  }
  // ... more fluent methods
}
```

**Modern Approach (2026+):**

One command generates everything:

```bash
# Prime existing app as a hyperfrontend feature
npx nx g @hyperfrontend/features:init my-app

✓ Analyzed project structure
✓ Generated feature.config.json
✓ Created contracts schema
✓ Wrapped app with nexus integration
✓ Generated shell project: my-app-shell/
```

The generated shell provides framework-natural consumption:

```typescript
// React Host
import { MyAppFeature } from '@hyperfrontend/shell-my-app/react'
<MyAppFeature config={{ theme: 'dark' }} onEvent={handleEvent} />

// Vue Host
import { MyAppFeature } from '@hyperfrontend/shell-my-app/vue'
<MyAppFeature :config="{ theme: 'dark' }" @event="handleEvent" />

// Vanilla JS (CDN)
<script src="https://cdn.example.com/shell-my-app.js"></script>
<script>
  new HyperfrontendMyApp('#container', { theme: 'dark' }).mount()
</script>
```

### Shell Distribution Flavors

1. **npm package**: Zero-dependency (apart from hyperfrontend packages), tree-shakeable at compile time for modern frameworks with build steps

2. **CDN script**: Self-contained UMD bundle with no dependencies, consumed via globals for legacy applications without build steps

The shell contains:

- Frontend UI visual and style coordination
- Event bus and communication protocol
- Connection setup and lifecycle management
- Fluent, chainable API

**Critically**: The shell does NOT contain the feature app code itself—it loads the feature at runtime.

---

## Security Model

### Protocol Versions

| Protocol | Security Level               | Use Case                                             |
| -------- | ---------------------------- | ---------------------------------------------------- |
| **v1**   | Obfuscation only             | Trusted internal environments, same-origin features  |
| **v2**   | PKS (Public Key + Symmetric) | Untrusted environments, cross-origin, sensitive data |

### Isomorphic Security Architecture

Both browser and Node.js environments get the same security capabilities:

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY MATRIX                           │
├─────────────────────┬───────────────────┬───────────────────────┤
│      Capability     │      Browser      │        Node.js        │
├─────────────────────┼───────────────────┼───────────────────────┤
│  Entry Point        │  /browser/v1, v2  │  /node/v1, v2         │
│  Crypto API         │  Web Crypto API   │  Node crypto module   │
│  Transport          │  postMessage      │  IPC, HTTP, WebSocket │
│  Key Derivation     │  PBKDF2 100k iter │  PBKDF2 100k iter     │
│  Encryption         │  AES-256-GCM      │  AES-256-GCM          │
│  Time Passwords     │  UTC synchronized │  UTC synchronized     │
└─────────────────────┴───────────────────┴───────────────────────┘
```

### Future: Network-Protocol + Nexus Integration

Currently, `@hyperfrontend/nexus` handles communication while `@hyperfrontend/network-protocol` provides security. The vision is to compose them:

```typescript
// Future API (conceptual)
import { createBroker } from '@hyperfrontend/nexus'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v2'

const secureBroker = createBroker({
  name: 'secure-host',
  contract,
  protocol: createProtocol(logger, 60), // 60-min key rotation
})
```

---

## Isomorphic Design

A core architectural principle is **write once, run everywhere**. The isomorphic approach spans:

### Platform Mirroring

```
@hyperfrontend/network-protocol
├── browser/
│   ├── v1/  → Obfuscation protocol (Web Crypto)
│   └── v2/  → PKS encryption protocol (Web Crypto)
└── node/
    ├── v1/  → Obfuscation protocol (Node crypto)
    └── v2/  → PKS encryption protocol (Node crypto)

@hyperfrontend/cryptography
├── browser/  → Web Crypto API implementation
├── node/     → Node crypto implementation
└── common/   → Platform-agnostic utilities
```

### Backend Framework Integration

Node.js APIs are designed for easy integration with popular frameworks:

| Framework  | Integration Pattern                        |
| ---------- | ------------------------------------------ |
| Express.js | Middleware for request/response encryption |
| Node HTTP  | Direct integration with http.createServer  |
| Nest.js    | Injectable services, decorators            |

---

## Future Vision

### Roadmap Overview

```
2026 Q1: FOUNDATION
├── Complete @hyperfrontend/nexus (port from legacy MessageBroker)
├── Integrate network-protocol with nexus
├── Framework adapters:
│   ├── React: useNexus, useChannel hooks
│   ├── Vue: useNexus, useChannel composables
│   ├── Angular: NexusService, ChannelService
│   └── Svelte: nexus, channel stores

2026 Q2: AUTOMATION
├── Complete @hyperfrontend/features plugin
├── init generator: Transform any app → feature
├── Shell generation: Auto-create connector projects
├── add generator: Integrate features into hosts

2026 Q3: PERFORMANCE
├── @hyperfrontend/nexus-worker (new package)
├── Offload encryption/decryption to Web Workers
├── Non-blocking message processing
├── Worker pool management

2026 Q4: ENTERPRISE
├── Feature Registry service (discovery layer)
├── Enterprise-wide feature discoverability
├── Versioned feature catalog
├── (Experimental) Shadow DOM exploration
```

### Planned Components

#### 1. Web Worker Integration

To prevent encryption/decryption from blocking the UI thread:

```typescript
// Future API (conceptual)
import { createWorkerBroker } from '@hyperfrontend/nexus-worker'

const broker = createWorkerBroker({
  name: 'main-app',
  contract,
  workers: {
    pool: 4, // Number of workers
    encryption: true, // Offload encryption
    validation: true, // Offload schema validation
  },
})
```

#### 2. Feature Registry

An enterprise-wide registry for feature discovery:

```typescript
// Conceptual registry API
import { FeatureRegistry } from '@hyperfrontend/registry'

const registry = new FeatureRegistry({
  endpoint: 'https://registry.example.com',
})

// Discover available features
const features = await registry.list()
// [
//   { name: 'email-status', version: '2.1.0', description: '...' },
//   { name: 'user-profile', version: '1.0.0', description: '...' }
// ]

// Get feature shell
const shell = await registry.getShell('email-status', '2.1.0')
```

---

## How Everything Connects

### The Complete Picture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HYPERFRONTEND ECOSYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐  │
│  │   HOST APPLICATION  │    │   FEATURE APP #1    │    │   FEATURE APP #2    │  │
│  │   (React, Vue, etc) │    │   (Any Framework)   │    │   (Any Framework)   │  │
│  └──────────┬──────────┘    └──────────┬──────────┘    └──────────┬──────────┘  │
│             │                          │                          │              │
│             ▼                          ▼                          ▼              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                    @hyperfrontend/features (Nx Plugin)                       ││
│  │                                                                              ││
│  │    ┌─────────────┐              ┌─────────────┐              ┌─────────────┐││
│  │    │ Shell #1    │              │ Shell #2    │              │ Shell #3    │││
│  │    │ (generated) │              │ (generated) │              │ (generated) │││
│  │    └──────┬──────┘              └──────┬──────┘              └──────┬──────┘││
│  │           │                            │                            │        ││
│  └───────────┼────────────────────────────┼────────────────────────────┼────────┘│
│              │                            │                            │         │
│              ▼                            ▼                            ▼         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                          @hyperfrontend/nexus                                ││
│  │                                                                              ││
│  │     ┌────────────┐        ┌────────────┐        ┌────────────┐              ││
│  │     │  Broker    │───────▶│  Channel   │───────▶│  Channel   │              ││
│  │     │ (Host)     │        │  (App #1)  │        │  (App #2)  │              ││
│  │     └────────────┘        └────────────┘        └────────────┘              ││
│  │                                                                              ││
│  │     Contract Validation │ Lifecycle Events │ Origin Security                ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                        │                                         │
│                                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      @hyperfrontend/network-protocol                         ││
│  │                           (Optional Security Layer)                          ││
│  │                                                                              ││
│  │     Encryption │ Obfuscation │ Time-Based Keys │ Staged Queues              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                        │                                         │
│                                        ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                        FOUNDATION LIBRARIES                                  ││
│  │                                                                              ││
│  │  @hyperfrontend/cryptography  │  @hyperfrontend/state-machine               ││
│  │  @hyperfrontend/logging       │  @hyperfrontend/web-worker                  ││
│  │  @hyperfrontend/utils/*       │                                             ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Host → Feature → Host

```
1. HOST: User clicks "Open Feature"
   └─▶ Shell.load({ containerId: '#feature', config: {...} })

2. SHELL: Creates iframe, establishes connection
   └─▶ Nexus.addChannel('feature', iframe.contentWindow)
   └─▶ Channel.connect()  // Three-way handshake

3. FEATURE: Receives connection request
   └─▶ Validates contract compatibility
   └─▶ Accepts connection
   └─▶ Channel emits 'open' event

4. HOST: Connection established
   └─▶ Channel.send('CONFIG', { theme: 'dark' })

5. FEATURE: Receives config, renders UI
   └─▶ User interacts with feature
   └─▶ Channel.send('USER_ACTION', { action: 'submit', data: {...} })

6. HOST: Receives user action
   └─▶ Processes action (API call, state update, etc.)
   └─▶ Channel.send('DATA_UPDATE', { result: {...} })

7. FEATURE: Updates UI with result

8. USER: Clicks "Close"
   └─▶ Channel.disconnect()  // Graceful shutdown
   └─▶ Both sides cleanup resources
```

### Legacy → Modern Mapping

| Legacy Concept                  | Modern Equivalent     | Location                |
| ------------------------------- | --------------------- | ----------------------- |
| `MessageBroker`                 | `createBroker()`      | @hyperfrontend/nexus    |
| `MessageChannel`                | `broker.addChannel()` | @hyperfrontend/nexus    |
| `IChannelContract`              | `IChannelContract`    | @hyperfrontend/nexus    |
| `filter()`, `open()`, `close()` | Filter utilities      | @hyperfrontend/nexus    |
| Connector class                 | Generated Shell       | @hyperfrontend/features |
| Manual iframe setup             | Shell automation      | @hyperfrontend/features |
| Browserify build                | Nx + Rollup           | Modern toolchain        |
| Jasmine tests                   | Jest                  | Modern toolchain        |

---

## Conclusion

Hyperfrontend represents a decade of evolution in micro-frontend architecture. From the original messaging implementation to today's modular ecosystem, every component exists to solve real problems encountered in enterprise frontend development.

The project's strength lies in its layered architecture:

1. **Foundation**: Robust utilities and cryptographic primitives
2. **Communication**: Contract-validated, lifecycle-managed messaging
3. **Security**: Optional but production-grade encryption
4. **Automation**: Developer-friendly tooling that eliminates boilerplate

The future roadmap continues this evolution with Web Worker integration for performance, feature registries for enterprise discovery, and potential Shadow DOM exploration for lighter-weight embedding.

For contributors, the codebase is designed to be modular and testable. Each library has a clear responsibility, well-documented APIs, and comprehensive test coverage. The `_/` directory preserves the legacy implementations for historical context and migration reference.

**Hyperfrontend is not just a library—it's a complete solution for composing independently developed and deployed frontend applications.**

---

## Quick Reference

### Key Directories

| Path                                  | Purpose                                     |
| ------------------------------------- | ------------------------------------------- |
| `libs/nexus/`                         | Core messaging (broker, channel, contracts) |
| `libs/network-protocol/`              | Security layer (encryption, obfuscation)    |
| `libs/cryptography/`                  | Crypto primitives                           |
| `plugins/features/`                   | Nx plugin for shell generation              |
| `apps/demos/`                         | Example feature applications                |
| `_/legacy-shell-application-pattern/` | Production connector example (historical)   |

### Essential Commands

```bash
# List all projects
npx nx show projects

# Build a library
npx nx build lib-nexus

# Run tests
npx nx test lib-nexus

# Generate a new feature (future)
npx nx g @hyperfrontend/features:init my-app

# Serve documentation
npx nx serve docs
```

### Related Documents

- [ARCHITECTURE_EVOLUTION.md](_/ARCHITECTURE_EVOLUTION.md) — Visual evolution diagrams
- [LEGACY_PROJECTS_ANALYSIS.md](_/LEGACY_PROJECTS_ANALYSIS.md) — Deep analysis of legacy code
- [libs/network-protocol/ARCHITECTURE.md](libs/network-protocol/ARCHITECTURE.md) — Security architecture details

---

_This document is the single source of truth for hyperfrontend's context. Update it as the project evolves._
