# Hyperfrontend Manifesto

**Why this exists, where it's going, and what I won't build**

---

## Why This Exists

Hyperfrontend is a personal project years in the making, born from a simple frustration: the JavaScript ecosystem has become a battleground where frameworks compete rather than collaborate.

Every few years, a new framework emerges and fragments the community further. Teams rewrite working applications chasing the latest paradigm. Companies end up maintaining parallel implementations of the same business logic in Angular, React, and Vue—not because any framework is wrong, but because we never agreed on how to share.

This project is my attempt to solve that problem once and for all.

The goal isn't to replace frameworks or pick winners. It's to create a neutral protocol layer where **any framework can participate**. A React application and an Angular application should be able to collaborate at runtime without caring about each other's internals. Legacy code shouldn't need rewrites to integrate with modern systems.

The minimum bar is something useful that people don't hate using. The real vision is a focal point where the community can collaborate instead of splinter—an antithesis to the constant framework wars.

If this sounds idealistic, that's fine. Good software often starts that way.

---

## Scope Boundaries

I'm one person, and even with a small group of future maintainers, there's only so much we can realistically build and maintain well. These boundaries exist to keep the project focused and sustainable.

### Framework-Specific Adapters

I will not be building React hooks, Vue composables, Angular services, or Svelte stores. Ever.

This isn't because I don't think they'd be useful—they would be. But hyperfrontend's value is in the **protocol layer**, not framework bindings. The `createBroker()` and channel APIs are deliberately vanilla JavaScript. They work everywhere, with anything.

**If you want framework-specific ergonomics, build them yourself.** Seriously. A React hook wrapping `createBroker()` is maybe 30 lines of code. You know your patterns, your state management, your conventions better than I ever will. Build what makes sense for your team, publish it, share it with others using the same framework.

This is a feature, not a limitation. Framework experts should own framework integrations.

### Web Components / Shadow DOM

Hyperfrontend uses iframes for isolation. Not Shadow DOM. Not Web Components.

The reason is simple: iframes provide real security boundaries. They enforce the Same-Origin Policy. They isolate JavaScript runtimes. Shadow DOM gives you style encapsulation, but the JavaScript still shares a runtime—which means untrusted feature code could access your host application's globals, cookies, or DOM.

For trusted widgets on your own domain, Shadow DOM might be fine. But hyperfrontend is designed for scenarios where you're embedding applications you don't fully control. Iframes are the only browser primitive that actually delivers on that promise.

I'm not interested in supporting both models. It would complicate the security story and split focus. Pick the right tool for your use case—if you need Shadow DOM, other solutions exist.

---

## What's Done

### Security Layer

End-to-end encryption is integrated directly into the broker. See the [Architecture Guide](ARCHITECTURE.md#security-layer-network-protocol) for details.

```typescript
import { createBroker } from '@hyperfrontend/nexus'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v2'

const broker = createBroker({
  name: 'secure-host',
  contract,
  security: {
    protocol: createProtocol(logger, 60),
    required: true,
  },
})
```

**What this gives you:**

- Protocol negotiation during handshake (v1 obfuscation, v2 encryption, or none)
- Configurable fallback behavior
- All messages pass through the encryption pipeline automatically
- Time-based key rotation with clock skew tolerance

---

## What's Next

### Web Worker Offloading

Encryption and schema validation can block the UI thread on large messages. The plan is a new `@hyperfrontend/nexus-worker` package that offloads this work to a Web Worker pool.

```typescript
import { createWorkerBroker } from '@hyperfrontend/nexus-worker'

const broker = createWorkerBroker({
  name: 'main-app',
  contract,
  workers: {
    pool: 4,
    encryption: true,
    validation: true,
  },
})
```

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart TB
    subgraph MainThread["MAIN THREAD"]
        AppCode["Application Code"]

        subgraph WorkerBroker["Worker Broker (Coordinator)"]
            BrokerDesc["Routes messages to/from workers<br/>Manages worker pool lifecycle<br/>Handles worker failures gracefully"]:::cleanWide
        end

        AppCode --> WorkerBroker
    end

    subgraph WorkerPool["WORKER POOL"]
        direction LR
        Worker1["Worker 1<br/>───────────<br/>Encryption<br/>Obfuscation"]
        Worker2["Worker 2<br/>───────────<br/>Decryption<br/>Deobfuscation"]
        Worker3["Worker 3<br/>───────────<br/>Validation<br/>Schema Check"]
    end

    WorkerBroker --> Worker1
    WorkerBroker --> Worker2
    WorkerBroker --> Worker3

    classDef cleanWide text-align:left,padding:0px 0px 0px
```

The API stays compatible with `@hyperfrontend/nexus`—it's just faster for heavy workloads.

---

### Features Plugin Generators

The `@hyperfrontend/features` Nx plugin automates the tedious parts of turning an app into a hyperfrontend feature.

**`init` generator** — Transform an existing application:

```bash
npx nx g @hyperfrontend/features:init my-app
```

This analyzes your project, generates contract schemas, wraps the entry point with nexus integration, and scaffolds a companion shell project:

```
my-app/
├── feature.config.json
├── contracts/
│   ├── emitted.schema.json
│   └── accepted.schema.json
├── src/
│   └── nexus-bootstrap.ts
└── ...existing files

my-app-shell/
├── package.json
├── src/
│   └── index.ts
└── rollup.config.js
```

**`add` generator** — Consume a feature in a host application:

```bash
npx nx g @hyperfrontend/features:add --feature=my-feature --host=my-host
```

This installs the shell package, generates typed bindings from the feature's contracts, and creates example integration code.

**`shell` executor** — Build distributable shells:

```bash
npx nx shell my-app
```

Produces ESM and UMD bundles with TypeScript declarations.

---

### Feature Registry

Further out, I'd like to build a discovery service for organizations with many features. The idea is a lightweight registry where teams can publish feature metadata and shells, and host applications can discover what's available.

```typescript
import { FeatureRegistry } from '@hyperfrontend/registry'

const registry = new FeatureRegistry({
  endpoint: 'https://registry.example.com',
})

const features = await registry.list()
// [
//   { name: 'email-status', version: '2.1.0' },
//   { name: 'user-profile', version: '1.0.0' }
// ]

const shell = await registry.loadShell('email-status', '2.1.0')
shell.mount('#container', { theme: 'dark' })
```

This is lower priority than the core protocol work, but it's on my mind for organizations that end up with many features.

---

## Get Involved

If any of this resonates with you, I'd love your help. Every item here is designed to be independently implementable.

Before diving in:

1. Open an issue to discuss your approach
2. Reference this document and the [Architecture Guide](ARCHITECTURE.md)
3. Follow the patterns established in `@hyperfrontend/nexus`

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.
