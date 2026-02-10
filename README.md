# hyperfrontend

<p align="center">
  <img  width="300" src="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/logo/hyperfrontend.png?raw=true" alt="Coverage">
</p>
<p align="center">
  A hybrid micro-frontend pattern to embed live web applications with communication protocols, lifecycle, and contract standards
</p>

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/README.md#installation">Installation</a> |
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/README.md#quick-start">Quick Start</a> |
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

## What are hyperfrontend features?

A **hyperfrontend feature** is a standalone frontend application that provides distinct business value or functionality. Features can be built with any framework (React, Angular, Vue, Svelte, etc.) or vanilla JavaScript, and may manage their own state, have their own user authentication, connect to backend APIs, and maintain their own domain models.

### What is a Feature?

| **What a Feature IS**                                              | **What a Feature ISN'T**                          |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| A standalone web application with distinct business value          | A component or widget within a single framework   |
| Framework-agnostic (can use React, Vue, Angular, vanilla JS, etc.) | Tightly coupled to a specific parent application  |
| Self-contained with its own state management                       | A shared library or utility package               |
| Can run standalone or embedded in other applications               | A monolithic application that can't be decomposed |
| Has a clear domain model and API boundaries                        | A micro-library or helper function                |
| Independently deployable and versionable                           | A page or route within a single-page application  |

### Architecture

Each hyperfrontend feature uses the standard communication protocol provided by the **[@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus)** library. This enables:

- **Domain-agnostic contracts** - Features define clear interfaces for communication
- **Pub/sub event bus** - Features can publish and subscribe to events without direct dependencies
- **Runtime isolation** - Each feature operates independently with its own lifecycle

The **[@hyperfrontend/features](https://github.com/AndrewRedican/hyperfrontend/blob/main/plugins/features)** Nx plugin helps you:

1. **Prime existing web apps** into hyperfrontend features by adding the necessary configuration
2. **Generate shell applications** that know how to load your frontend app at runtime
3. **Consume features** in host applications with ease

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
- Standardized communication protocols via window messaging
- Lifecycle management for embedded applications
- Contract-based integration with clear boundaries
- Lightweight pub/sub message broker
- Cross-stack compatibility (React, Vue, Angular, Svelte, vanilla JS)
- Shell applications with zero external dependencies
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

The plugin automatically sets up the consumption pattern that works naturally with your chosen framework.

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

Full documentation is coming soon.

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
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/AndrewRedican"><img src="https://github.com/AndrewRedican.png" width="100px;" alt="Andrew Redican"/><br /><sub><b>Andrew Redican</b></sub></a><br /><a href="https://github.com/AndrewRedican/hyperfrontend/commits?author=AndrewRedican" title="Code">💻</a> <a href="https://github.com/AndrewRedican/hyperfrontend/commits?author=AndrewRedican" title="Documentation">📖</a> <a href="#infra-AndrewRedican" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-AndrewRedican" title="Maintenance">🚧</a> <a href="#projectManagement-AndrewRedican" title="Project Management">📆</a> <a href="#ideas-AndrewRedican" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://allcontributors.org) specification. Contributions of any kind are welcome!

## License

See [LICENSE.md](LICENSE.md) file for details.
