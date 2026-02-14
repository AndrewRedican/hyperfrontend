---
title: Core Concepts
weight: 2
---

A **hyperfrontend feature** is a standalone frontend application that provides distinct business value or functionality. Features can be built with any framework (React, Angular, Vue, Svelte, etc.) or vanilla JavaScript, and may manage their own state, have their own user authentication, connect to backend APIs, and maintain their own domain models.

### What is a Feature?

A hyperfrontend feature combines traits from [micro-frontends](https://en.wikipedia.org/wiki/Micro_frontend) and embeddable components, with unique characteristics for secure runtime integration:

```mermaid
---
config:
  theme: base
  themeVariables:
    fontSize: 12px
---
flowchart LR
    subgraph MF["🧩 Micro-Frontend Traits"]
        direction TB
        M1["Independent deployment"]
        M2["Own tech stack"]
        M3["Team autonomy"]
        M4["Separate releases"]
    end

    subgraph CP["📦 Component Traits"]
        direction TB
        C1["Embeddable"]
        C2["Defined API"]
        C3["Lifecycle hooks"]
        C4["Host integration"]
    end

    subgraph HF["⚡ Hyperfrontend Feature"]
        direction TB
        H1["🔒 Iframe isolation"]
        H2["📨 Contract messaging"]
        H3["⚡ Runtime loading"]
        H4["🔐 Optional encryption"]
    end

    MF -.->|combines| HF
    CP -.->|combines| HF

    style MF fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style CP fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style HF fill:#fff3e0,stroke:#e65100,stroke-width:3px
```

**Not a feature:** UI components, shared libraries, SPA routes, or [monolithic](https://en.wikipedia.org/wiki/Monolithic_application) frontends.

### Architecture

Each hyperfrontend feature uses the standard communication protocol provided by the **[@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus)** library. This enables:

- **Contract-validated messaging** - Features define clear interfaces specifying emitted and accepted message types
- **Broker-channel architecture** - A TCP-like protocol over the browser's postMessage API routes messages between contexts
- **Iframe-based isolation** - Each feature operates in its own browser context with true security boundaries

For a deep dive into how the libraries compose together, see the **[Architecture Guide](ARCHITECTURE.md)**.

The **[@hyperfrontend/features](https://github.com/AndrewRedican/hyperfrontend/blob/main/plugins/features)** Nx plugin helps you:

1. **Transform existing web apps** into hyperfrontend features by adding the necessary configuration
2. **Generate shell applications** that know how to load your frontend app at runtime
3. **Consume features** in host applications with typed bindings

Each feature gets an accompanying **shell application** that is:

- Self-contained with no external dependencies
- Installable as an npm package or via `<script>` tag from a CDN
- Responsible for loading and initializing the feature at runtime

This architecture enables you to compose applications from independently developed and deployed features, enabling true micro-frontend modularity.

## Benefits

### Free Teams from Deployment Coordination

Hyperfrontend eliminates the need for teams to coordinate deployments, especially critical for organizations with:

- **Global teams** spanning multiple timezones
- **Different priorities and roadmaps** for each team
- **Varied technical capabilities** and framework preferences

Each feature is independently deployable - no more waiting for other teams to merge, test, or deploy before shipping your updates.

### Protect Against Version Thrashing

Traditional build-time integration creates tight coupling that leads to:

- Dependency conflicts when teams upgrade at different rates
- Breaking changes that cascade across the entire application
- Forced upgrades that consume valuable development time

Hyperfrontend's runtime integration approach isolates each feature's dependencies, allowing teams to:

- Upgrade frameworks on their own schedule
- Use different versions of the same library across features
- Deploy updates without breaking other features

### Modernize Without Expensive Rewrites

Hyperfrontend makes existing brownfield or mature projects easily consumable:

- **Wrap legacy applications** as features without rewriting them
- **Incrementally modernize** - replace features one at a time
- **Mix old and new** - run legacy AngularJS alongside modern React
- **Preserve investments** - keep working code working while evolving

The shell package defines a clear interface to interact with each feature, abstracting away the complexity of frontend coordination regardless of the underlying technology.

### Still Modern and Developer-Friendly

Despite its flexibility, hyperfrontend caters to modern frontend setups:

- Full TypeScript support with type-safe contracts
- Works with all modern build tools (Vite, Webpack, Rollup, etc.)
- Compatible with SSR and static site generation
- Nx plugin for streamlined development workflows
- Standard npm packages or CDN distribution

## Capabilities

- Framework-agnostic micro-frontend architecture
- Standardized communication via the browser's postMessage API (iframes, windows, tabs, web workers)
- Lifecycle management for embedded applications
- Contract-based integration with JSON Schema validation
- Broker-channel message routing with optional encryption
- Cross-stack compatibility (React, Vue, Angular, Svelte, vanilla JS)
- Shell applications with all dependencies bundled in
- Multiple deployment options (npm package or CDN script tag)

## Architecture Diagram

```mermaid
graph TD
    A[Host Application] -->|Embeds| B[Feature 1: React]
    A -->|Embeds| C[Feature 2: Vue]
    A -->|Embeds| D[Feature 3: Angular]
    B -.->|window.postMessage| E[Communication Protocol]
    C -.->|window.postMessage| E
    D -.->|window.postMessage| E
    E -->|Events| F[Pub/Sub Event Bus]
```

{{< callout type="info" >}}
  Each feature is completely isolated with its own dependencies, state, and lifecycle.
{{< /callout >}}

## How It Works

1. **Features** are standalone applications with clear interfaces
2. **Shell applications** load and initialize features at runtime
3. **Communication protocol** enables secure cross-frame messaging
4. **Event bus** provides decoupled pub/sub architecture
5. **Lifecycle hooks** manage mount, unmount, and update operations

## Use Cases

### Multi-Team Organizations

Perfect for organizations where:
- Teams work across different timezones
- Each team has independent priorities and roadmaps
- Different technical capabilities and framework preferences exist

### Legacy Modernization

Ideal for:
- Wrapping legacy applications without rewrites
- Incrementally replacing old components
- Running legacy and modern code side-by-side

### Micro-Frontend Architecture

Enables:
- Independent feature development and deployment
- Version isolation and independent upgrade cycles
- Mix-and-match framework strategies
