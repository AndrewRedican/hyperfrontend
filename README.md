# hyperfrontend

<p align="center">
  <img  width="300" src="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/logo/hyperfrontend.png?raw=true" alt="Coverage">
</p>
<p align="center">
  A hybrid <a href="https://en.wikipedia.org/wiki/Micro_frontend">micro-frontend</a> pattern to embed live web applications with communication protocols, lifecycle, and contract standards
</p>

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/MANIFESTO.md">Manifesto</a> |
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/README.md#installation">Installation</a> |
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/README.md#quick-start">Quick Start</a> |
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/ARCHITECTURE.md">Architecture</a> |
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/README.md#live-demos">Live Demos</a>
</p>

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-main.yml?style=flat-square&logo=github&label=build" alt="Build Status">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/codecov/c/github/AndrewRedican/hyperfrontend?style=flat-square&logo=codecov" alt="Coverage">
  </a>
  <a href="https://github.com/sponsors/AndrewRedican">
    <img src="https://img.shields.io/badge/Sponsor-❤️-ff69b4?style=flat-square" alt="Sponsor">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
</p>

---

Look, nobody cares what framework you're using. [React](https://react.dev/), [Angular](https://angular.dev/), [Vue](https://vuejs.org/), that [jQuery](https://jquery.com/) thing from 2014 — whatever. You just want to ship the damn thing and go home.

Hyperfrontend lets you **compose your existing apps together securely** — like Lego bricks. No rewrites. No "let's align on a shared component library" meetings. Just plug it in and _it works_.

Display another app inside yours with a native look and feel — embed it seamlessly inline, throw it in a modal, pop it out in a new window, open a new tab. Your call. And you don't have to roll your own glue code to make them talk to each other.

Need to pass sensitive stuff between apps? Transactions, [PII](https://en.wikipedia.org/wiki/Personal_data), [auth tokens](https://en.wikipedia.org/wiki/Access_token)? Opt into the **encrypted messaging protocol**. It's built to stop [man-in-the-middle](https://en.wikipedia.org/wiki/Man-in-the-middle_attack) snooping and limit [XSS](https://en.wikipedia.org/wiki/Cross-site_scripting) blast radius — not just "button clicked" events, but the stuff that actually matters.

> Want the full picture? The [Manifesto](MANIFESTO.md) digs into the _why_ behind all of this.

---

## What is a Hyperfrontend Feature?

A **hyperfrontend feature** is your standalone frontend app — whether it was written ten years ago or last month. It could be React, Angular, Vue, Svelte, vanilla JS... doesn't matter. It manages its own state, handles its own auth, talks to its own backend. It's _yours_.

The difference? Now it can be plugged into other apps (or have other apps plugged into it) without anyone having to rewrite anything.

Think of it as combining the best of [micro-frontends](https://en.wikipedia.org/wiki/Micro_frontend) and embeddable components:

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

## How It Works

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

## Why Hyperfrontend?

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

## Key Capabilities

- Framework-agnostic micro-frontend architecture
- Standardized communication via the browser's postMessage API (iframes, windows, tabs, web workers)
- Lifecycle management for embedded applications
- Contract-based integration with JSON Schema validation
- Broker-channel message routing with optional encryption
- Cross-stack compatibility (React, Vue, Angular, Svelte, vanilla JS)
- Shell applications with all dependencies bundled in
- Multiple deployment options (npm package or CDN script tag)

## Installation

First, ensure you have an [Nx workspace](https://nx.dev/getting-started/intro) set up.

Then add the hyperfrontend features plugin:

```bash
npx nx add @hyperfrontend/features
```

This will automatically install the `@hyperfrontend/nexus` library and configure your workspace.

## Quick Start

### Creating a Feature

Initialize an existing application as a hyperfrontend feature:

```bash
npx nx g @hyperfrontend/features:init
```

The generator will prompt you for:

- Which project to target
- Where to store the feature configuration and contracts

### Consuming a Feature

Add a feature to a host application:

```bash
npx nx g @hyperfrontend/features:add
```

The generator will prompt you for:

- The feature name
- Which host project to add it to

The plugin generates typed bindings from the feature's contracts and vanilla JavaScript integration code.

### Testing Your Feature

Run the playground host to see how your feature loads:

```bash
npx nx serve <your-feature-name>
```

This launches a development environment where you can debug and interact with your feature in isolation.

## Live Demos

| Demo                                                    | Description                |
| ------------------------------------------------------- | -------------------------- |
| [Chess](https://hyperfrontend.dev/demo/chess)           | Chess game demonstration   |
| [Clock](https://hyperfrontend.dev/demo/clock)           | Clock demonstration        |
| [Events](https://hyperfrontend.dev/demo/events)         | Events demonstration       |
| [File Share](https://hyperfrontend.dev/demo/file-share) | File sharing demonstration |
| [Heartbeat](https://hyperfrontend.dev/demo/heartbeat)   | Heartbeat demonstration    |
| [Views](https://hyperfrontend.dev/demo/views)           | Views demonstration        |

## Main Packages

| Package                                                                                              | Description                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@hyperfrontend/features](https://github.com/AndrewRedican/hyperfrontend/blob/main/plugins/features) | Nx plugin for hyperfrontend micro-frontend features [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/plugins/features/README.md)                     |
| [@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus)          | Cross-window communication with contracts, lifecycle management, and security [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/README.md) |

## Internal Packages

| Package                                                                                                        | Description                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [cryptography](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/cryptography)                     | Cryptography utilities for browser and Node.js environments [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/cryptography/README.md)                    |
| [data-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/data)                         | Data manipulation and transformation utilities [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/data/README.md)                                   |
| [function-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/function)                 | Function composition and manipulation utilities [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/function/README.md)                              |
| [immutable-api-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/immutable-api)       | Immutable API utilities for functional programming [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/immutable-api/README.md)                      |
| [list-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/list)                         | List and array manipulation utilities [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/list/README.md)                                            |
| [logging](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/logging)                               | Structured logging utilities for applications [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/logging/README.md)                                       |
| [network-protocol](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol)             | Network protocol implementation with channels, routing, and security [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/README.md)       |
| [random-generator-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/random-generator) | Random number and data generation utilities [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/random-generator/README.md)                          |
| [state-machine](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/state-machine)                   | State machine implementation with lifecycle management, actions, and reducers [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/state-machine/README.md) |
| [string-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/string)                     | String manipulation utilities for browser and Node.js environments [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/string/README.md)             |
| [time-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/time)                         | Time and date manipulation utilities [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/time/README.md)                                             |
| [ui-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/ui)                                   | UI utilities for elements, events, styling, and mobile interactions [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/ui/README.md)                      |
| [web-worker](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/web-worker)                         | Web Worker utilities and abstractions [See docs](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/web-worker/README.md)                                            |

## Documentation

A comprehensive documentation site is under active development at [hyperfrontend.dev](https://www.hyperfrontend.dev).

**What to expect:**

- **Complete API Reference** — Auto-generated documentation for all libraries with TypeScript types, parameters, and examples
- **Versioned Documentation** — Match documentation to your installed package version
- **Fuzzy Search** — Find what you need instantly with Algolia-powered search
- **Interactive Code Examples** — Syntax-highlighted, copyable code snippets
- **Architecture Guides** — Deep dives into how the libraries work together
- **Getting Started Tutorials** — Step-by-step guides for common use cases

**Current documentation:**

- Each library has a detailed README with installation, usage, and architecture information
- See the [Main Packages](#main-packages) and [Internal Packages](#internal-packages) tables above for links
- [Architecture Guide](ARCHITECTURE.md) explains how the libraries compose together
- [Manifesto](MANIFESTO.md) explains the project's philosophy and scope

For the documentation roadmap, see [roadmap/documentation-roadmap.md](roadmap/documentation-roadmap.md).

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Setting up your development environment (we recommend using GitHub Codespaces!)
- Our code of conduct and contribution process
- How to submit pull requests
- Coding standards and commit message guidelines

**Important**: All contributors must sign our [Contributor License Agreement (CLA)](CONTRIBUTING.md#contributor-license-agreement-cla) before pull requests can be merged.

## Security

If you discover a security vulnerability, please follow our responsible disclosure process outlined in our [Security Policy](SECURITY.md). Do not report security issues through public GitHub issues.

## Support & Funding

If you find hyperfrontend useful, please consider supporting the project:

- ⭐ [Star the repository](https://github.com/AndrewRedican/hyperfrontend)
- 💖 [Sponsor on GitHub](https://github.com/sponsors/AndrewRedican)
- 📣 [Share on X](https://twitter.com/intent/tweet?text=Check%20out%20hyperfrontend%20-%20a%20hybrid%20micro-frontend%20pattern%20for%20embedding%20live%20web%20apps%20with%20communication%20protocols%20and%20lifecycle%20management&url=https://github.com/AndrewRedican/hyperfrontend)

See [FUNDING.md](FUNDING.md) for more ways to support the project.

## Contributors

Thanks to these wonderful people who have contributed to hyperfrontend:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/AndrewRedican"><img src="https://github.com/AndrewRedican.png?s=100" width="100px;" alt="Andrew Redican"/><br /><sub><b>Andrew Redican</b></sub></a><br /><a href="https://github.com/AndrewRedican/hyperfrontend/commits?author=AndrewRedican" title="Code">💻</a> <a href="https://github.com/AndrewRedican/hyperfrontend/commits?author=AndrewRedican" title="Documentation">📖</a> <a href="#infra-AndrewRedican" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-AndrewRedican" title="Maintenance">🚧</a> <a href="#projectManagement-AndrewRedican" title="Project Management">📆</a> <a href="#ideas-AndrewRedican" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bbsmithy"><img src="https://github.com/bbsmithy.png?s=100" width="100px;" alt="Brian Smith"/><br /><sub><b>Brian Smith</b></sub></a><br /><a href="#ideas-bbsmithy" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td align="center" size="13px" colspan="7">
        <img src="https://raw.githubusercontent.com/all-contributors/all-contributors-cli/1b8533af435da9854653492b1327a23a4dbd0a10/assets/logo-small.svg">
          <a href="https://all-contributors.js.org/docs/en/bot/usage">Add your contributions</a>
        </img>
      </td>
    </tr>
  </tfoot>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://allcontributors.org) specification. Contributions of any kind are welcome!

## License

See [LICENSE.md](LICENSE.md) file for details.
