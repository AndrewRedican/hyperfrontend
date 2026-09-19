<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/logo/hf-dark.svg?raw=true">
    <img width="160" src="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/logo/hf-light.svg?raw=true" alt="The hyperfrontend cube">
  </picture>
</p>

<h1 align="center">hyperfrontend</h1>

<p align="center">
  Compose web apps built on different stacks into one product at run time, over a typed, secured channel.
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev">Docs</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="https://www.hyperfrontend.dev/demos/">Demos</a> ·
  <a href="#packages">Packages</a> ·
  <a href="MANIFESTO.md">Manifesto</a>
</p>

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-main.yml?style=flat-square&labelColor=161b26&logo=github&logoColor=white&label=build" alt="Build status of the main branch">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/codecov/c/github/AndrewRedican/hyperfrontend?style=flat-square&labelColor=161b26&logo=codecov&logoColor=white" alt="Test coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/features">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/features?style=flat-square&labelColor=161b26&color=7db8ff&logo=npm&logoColor=white&label=%40hyperfrontend%2Ffeatures" alt="Latest version of @hyperfrontend/features on npm">
  </a>
  <a href="LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-7db8ff?style=flat-square&labelColor=161b26" alt="MIT license">
  </a>
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/features/">
    <img width="832" src="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/media/readme-compose/hero.gif?raw=true" alt="A host page with three empty slots. Three application windows, a React one, an Angular one and a jQuery one, each served from its own address, slide in from the right and seat into the slots one after another; a wire draws from the host's hub to each seated window, and named messages such as order-placed cross the wires in both directions. Each window keeps its own chrome and origin inside the host, and a faint outline stays at its original address.">
  </a>
</p>

Your React app, the Angular one next door, and that jQuery thing from 2014 can share a page without sharing a build. Each stays its own deployment at its own origin. The host installs one shell package and talks to it over a typed contract, sealed with per-session keys when the payload matters. That is [`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/): the SDK, the `hf` CLI and the dev server.

## How it works

<p align="center">
  <a href="https://www.hyperfrontend.dev/architecture">
    <img width="832" src="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/media/readme-anatomy/figure.png?raw=true" alt="A host application at app.example.com loads a feature shell, which draws an isolation boundary, a browsing context, around the feature application served from checkout.team-b.dev; contract messages cross between them. Four numbered ideas: runtime loading, isolation boundary, typed validated contract, independent deployment. Below, a cross-section of the channel shows its layers: features for the shell, display modes and session lifecycle; nexus for the handshake, contract and heartbeat; network-protocol for the sealed session envelope; cryptography for AES-GCM, ECDH and HKDF at the core.">
  </a>
</p>

The [architecture guide](ARCHITECTURE.md) walks the seam in depth: the handshake, the four-state liveness watchdog, and the polite teardown. The [security model](https://www.hyperfrontend.dev/docs/core-concepts/security) says what the sealed envelope is worth against which adversary, and which controls stay yours.

## See it running

<p align="center">
  <a href="https://www.hyperfrontend.dev/demos/#koi-pond">
    <img width="560" height="315" src="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/media/koi-pond/hero-clip.gif?raw=true" alt="Eight koi swimming in a single pond, each one rendered by a different framework app">
  </a>
</p>

Eight koi, eight frameworks, eight separately deployed apps, one pond. The [gallery](https://www.hyperfrontend.dev/demos/) also runs [Clock](https://www.hyperfrontend.dev/demos/#clock), a Vue timepiece in a React host across a cross-site boundary, and [Heartbeat](https://www.hyperfrontend.dev/demos/#heartbeat), liveness and latency, and what a host should do when a feature stops answering.

## Get started

```bash
npm install @hyperfrontend/features
```

A feature declares what it sends and accepts; a host mounts it and gets a typed handle back:

```typescript
// In the feature app, from '@hyperfrontend/features/hostee'
const feature = createFeature({ name: 'checkout', contract })
await feature.ready()
feature.send('order-placed', { id: 'A-1094' })

// In the host app, from '@hyperfrontend/features/host'
const checkout = createShell({ modes: { dialog: mountDialog }, url: 'https://checkout.example.com' })
checkout.on('order-placed', (order) => showReceipt(order))
checkout.open({ displayMode: DisplayMode.Dialog })
```

The bundled `hf` CLI turns an existing app into a feature and packs the shell a host installs:

```bash
# scaffold the feature side into an existing app
npx @hyperfrontend/features init
# bundle a self-contained shell package, with the security envelope baked in
npx @hyperfrontend/features build --protocol v4
# serve both sides locally, with a debug UI for the traffic between them
npx @hyperfrontend/features dev
```

Start with [Core Concepts](https://www.hyperfrontend.dev/docs/core-concepts), then the [guides and tutorials](https://www.hyperfrontend.dev/docs/guides/), each one verified against code that runs. Every option, handle and payload type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/features/#api-reference). Not sure the pattern fits your case? Take the [fit assessment](https://www.hyperfrontend.dev/docs/is-hyperfrontend-right-for-you).

## Packages

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/">
    <img width="832" src="https://github.com/AndrewRedican/hyperfrontend/blob/main/assets/media/readme-ecosystem/figure.png?raw=true" alt="The published packages as a map: features at the top; nexus and network-protocol under it as cross-window messaging, with an arrow from network-protocol to cryptography, which seals the channel; cryptography, state-machine and logging grouped as packages that stand on their own; builder, which packs the shell, versioning, project-scope and questions grouped as build and release tooling; and nine utilities along the foot, from json-utils to function-utils.">
  </a>
</p>

Every package is published on its own and documented on the [libraries index](https://www.hyperfrontend.dev/docs/libraries/), the flagship first and the single-purpose utilities last. The ones under the flagship exist because it needed them, and each one solves a problem an application has whether or not it is a micro-frontend.

<details>
<summary>All nineteen packages</summary>

| npm                                                                                                                           | What it does                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@hyperfrontend/features](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/features)                             | The SDK, CLI and dev server: embed another team's app over a typed, supervised channel · [docs](https://www.hyperfrontend.dev/docs/libraries/features/)                   |
| [@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus)                                   | Contract-validated messaging between windows, frames and workers, over a real handshake · [docs](https://www.hyperfrontend.dev/docs/libraries/nexus/)                     |
| [@hyperfrontend/network-protocol](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol)             | A session-keyed, replay-proof envelope for cross-window messages, on any transport · [docs](https://www.hyperfrontend.dev/docs/libraries/network-protocol/)               |
| [@hyperfrontend/builder](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/builder)                               | Bundles a TypeScript library into ESM, CJS, IIFE and UMD, and writes the manifest that ships with it · [docs](https://www.hyperfrontend.dev/docs/libraries/builder/)      |
| [@hyperfrontend/versioning](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/versioning)                         | From conventional commits to the bump, the version and the changelog entry · [docs](https://www.hyperfrontend.dev/docs/libraries/versioning/)                             |
| [@hyperfrontend/project-scope](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/project-scope)                   | Reads a repository it has never seen, scores what it finds, and stages writes until you commit them · [docs](https://www.hyperfrontend.dev/docs/libraries/project-scope/) |
| [@hyperfrontend/questions](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/questions)                           | Terminal prompts that return a value, never an exception · [docs](https://www.hyperfrontend.dev/docs/libraries/questions/)                                                |
| [@hyperfrontend/json-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/json)                         | JSON Schema validation that reports every violation at once, with the pointer that found it · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/json/)            |
| [@hyperfrontend/ui-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/ui)                             | DOM utilities that hand back their own teardown: styles, gestures, element lifecycle, colour · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/ui/)             |
| [@hyperfrontend/immutable-api-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/immutable-api)       | Built-ins captured before untrusted code runs, and objects nothing can tamper with after · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/)      |
| [@hyperfrontend/state-machine](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/state-machine)                   | The lifecycle of an async operation as a store, with the states a lone isLoading cannot tell apart · [docs](https://www.hyperfrontend.dev/docs/libraries/state-machine/)  |
| [@hyperfrontend/logging](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/logging)                               | Structured, levelled logging with channels and timers · [docs](https://www.hyperfrontend.dev/docs/libraries/logging/)                                                     |
| [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/cryptography)                     | Password and key encryption with one call, the same in the browser and in Node.js · [docs](https://www.hyperfrontend.dev/docs/libraries/cryptography/)                    |
| [@hyperfrontend/data-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/data)                         | Walk, compare and repair data structures, circular references included · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/data/)                                 |
| [@hyperfrontend/time-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/time)                         | Timers that can be paused and resumed, intervals, and time normalisation · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/time/)                               |
| [@hyperfrontend/random-generator-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/random-generator) | Seeded, reproducible random draws from real distributions, plus UUIDs · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/random-generator/)                      |
| [@hyperfrontend/string-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/string)                     | Base64 and friends that encode UTF-8 first, identical in the browser and in Node.js · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/string/)                  |
| [@hyperfrontend/list-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/list)                         | FIFO and LIFO lists of objects held by reference, with the filtering and iteration to match · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/list/)            |
| [@hyperfrontend/function-utils](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/utils/function)                 | Wrappers that change what a call does without changing what it looks like · [docs](https://www.hyperfrontend.dev/docs/libraries/utils/function/)                          |

</details>

## Documentation

- [hyperfrontend.dev](https://www.hyperfrontend.dev): the API reference generated from every library, the guides, the demos, site-wide search, and the [articles](https://www.hyperfrontend.dev/articles/) with an [Atom feed](https://www.hyperfrontend.dev/feed.xml)
- [Architecture](ARCHITECTURE.md): how the libraries compose, and why the seams sit where they do
- [Library compatibility](LIBRARY_COMPATIBILITY.md): where every package runs and what it publishes, generated from the manifests
- [Manifesto](MANIFESTO.md): why this exists, where it is going, and what it will not build
- [Acknowledgments](ACKNOWLEDGMENTS.md): the humans behind the code

## Contributing

Read the [contributing guide](CONTRIBUTING.md) for the development setup (GitHub Codespaces works out of the box), the contribution process, and the coding and commit conventions. Every contributor signs the [Contributor License Agreement](CONTRIBUTING.md#contributor-license-agreement-cla) before a pull request can merge. If you use LLM assistance, [REGARDING_AI.md](REGARDING_AI.md) describes how AI tooling is used here.

## Security

Report vulnerabilities through the [security policy](SECURITY.md), never through a public issue.

## Support

Star the repository, [write to the project](https://www.hyperfrontend.dev/support/) with a question, or see [FUNDING.md](FUNDING.md) for ways to support the work.

## Contributors

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square&labelColor=161b26)](#contributors)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

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

This project follows the [all-contributors](https://allcontributors.org) specification. Contributions of any kind are welcome.

## License

[MIT](LICENSE.md)
