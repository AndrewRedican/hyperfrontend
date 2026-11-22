# @hyperfrontend/server

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-server.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-server.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=server">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=server" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/server">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/server?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/server">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fserver?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/server">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/server?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

HTTP kernel for Node.js services: a listener with graceful shutdown, a step pipeline, static file serving with compression and conditional requests, and ordered header rules.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/server/)

• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fserver)

## What is @hyperfrontend/server?

[`@hyperfrontend/server`](https://www.hyperfrontend.dev/docs/libraries/server/) is a small HTTP kernel for Node.js: helpers that start and stop a server, a pipeline of steps that each return a complete response, and a static file server built on that pipeline. It is the HTTP layer of the static server in [`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/), published on its own.

It is not a web framework. There is no router, no request body and no asynchronous middleware, and it loads no configuration file: you hand it a serving plan as an object. To serve a built micro-frontend from the command line, use `hf serve` from [`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/server/), which finds and resolves the plan for you.

### Key Features

- **Listener helpers** - Start a server and get the bound port back, with a refused port as a rejected promise
- **Graceful shutdown** - One promise that settles on an interrupt or terminate signal, ready to await before closing
- **Step pipeline** - A step answers a request or delegates inward and transforms the response that comes back
- **Static file serving** - Content types, directory indexes, a redirect to the slashed directory URL, and 404 for dotfiles and symlinked paths
- **Compression** - Brotli or gzip by negotiation for text responses, compressed once per file and encoding
- **Conditional requests** - A weak entity tag on every file, and 304 when the client already holds it
- **Ordered header rules** - Response headers by path prefix and suffix, a later rule overriding an earlier one per header
- **Framing policy as a field** - A list of embedders expands into the header that says who may frame a page
- **Cross-origin isolation in one word** - A declared isolation expands into the three headers that produce it
- **Header presets** - Functions that write a content security policy, a permissions policy and cache rules for you
- **Policy without Node.js** - The config shape, its validators and the presets sit in an entry that imports no built-in
- **No dependencies** - The published package is self-contained; installing it adds nothing else

### Architecture Highlights

- **The root confines every path**: a request path is decoded once and resolved under the root; a path that escapes answers 403, a malformed encoding 400. No symlink at or below the root is followed: a path that is one, or that passes through one, answers 404.
- **A rule follows the file that is served**: a rule bounded by a prefix or suffix is matched against the file's path as the file system stores it, so a request that reaches the file under another letter case or a Windows short name is sent the headers of that file.
- **The pipeline owns the headers that describe the body**: a header rule cannot override `Content-Length`, `Content-Encoding` or the entity tag.
- **Every answer carries the plan's headers**: the rules are folded over each response the built-in steps give, a 405 for a refused method included.
- **One request cannot stop the server**: a step that throws is answered with 500, which carries the rules too and is marked `Cache-Control: no-store`.

The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/server/architecture/) covers the order of the built-in steps, how header rules fold and when a response is compressed.

## Why Use @hyperfrontend/server?

### Headers a reviewer can read

What a deployment sends is a list of rules in a plain object: which paths, which headers, in which order. Who may frame a page, which browser features it may use and whether it is cross-origin isolated are one field each instead of headers spelled by hand. The validators report every problem of a config at once when the plan loads, not on the first request that matches a rule, and refuse a rule that would silently drop the framing policy.

### A pipeline you can test without a port

A step is a function from a request value to a response value, and the file reads, the server factory and the log sink are all parameters. A spec runs the whole pipeline over an in-memory site.

### Nothing else to install

The package has no dependencies. It serves a built site with compression, entity tags and the right content types on Node.js 18 or later.

## Installation

```bash
npm install @hyperfrontend/server
```

Requires Node.js 18 or later.

## Quick Start

Serve a directory that one other site may frame, with cross-origin isolation and two cache rules, until the process is stopped:

```typescript
import { resolve } from 'node:path'
import { startStaticServer, waitForShutdown } from '@hyperfrontend/server'
import { expandHeaderPolicy, immutableAssets } from '@hyperfrontend/server/policy'

const server = await startStaticServer(
  {
    root: resolve('dist/site'),
    port: 8080,
    log: true,
    headers: expandHeaderPolicy({
      embedders: ["'self'", 'https://host.example'],
      isolation: 'require-corp',
      headers: [{ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }, immutableAssets('/assets/')],
    }),
  },
  { log: (line) => console.log(line) }
)

console.log(`Serving ${server.url}`)
await waitForShutdown()
await server.close()
```

The root is an absolute path, and port `0` lets the operating system choose one; read it back from the handle. The access log is written only when a log function is passed as well: `log: true` on its own prints nothing. [`expandHeaderPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-expandHeaderPolicy) turns the declared fields into rules placed ahead of the authored ones. It checks those fields and the rules the way the config validator does, and throws when a rule is malformed, a source would permit every origin, or a rule undoes the declared embedders.

A step placed in front of the built-ins sees every request first and every response last. What such a step answers by itself carries no header rule, since the rules are applied by the built-in steps:

```typescript
import type { ServeStep } from '@hyperfrontend/server'
import { plainResponse, startStaticServer } from '@hyperfrontend/server'

const health: ServeStep = (request, context, next) => {
  return request.url === '/healthz' ? plainResponse(200, 'ok') : next()
}

const plan = { root: process.cwd(), port: 0, log: false, headers: [] }
const server = await startStaticServer(plan, { steps: [health] })
```

## API Overview

| Entry                                                                           | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@hyperfrontend/server`](https://www.hyperfrontend.dev/docs/libraries/server/) | The listener helpers, [`waitForShutdown`](https://www.hyperfrontend.dev/docs/libraries/server/#api-waitForShutdown), the step pipeline ([`runSteps`](https://www.hyperfrontend.dev/docs/libraries/server/#api-runSteps), [`buildServeSteps`](https://www.hyperfrontend.dev/docs/libraries/server/#api-buildServeSteps)), the static server ([`startStaticServer`](https://www.hyperfrontend.dev/docs/libraries/server/#api-startStaticServer), [`createServeListener`](https://www.hyperfrontend.dev/docs/libraries/server/#api-createServeListener)) and its path helpers                                                                                        |
| [`/policy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/)        | The serve config as data: [`defineServeConfig`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-defineServeConfig), [`validateServeConfig`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-validateServeConfig) and [`checkServeConfig`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-checkServeConfig), [`expandHeaderPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-expandHeaderPolicy) and [`applyHeaderRules`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-applyHeaderRules), the header presets and the config types, with no Node.js built-in behind them |

[`createServeListener`](https://www.hyperfrontend.dev/docs/libraries/server/#api-createServeListener) returns the request listener without starting anything, for a server you create yourself. [`createStaticHandler`](https://www.hyperfrontend.dev/docs/libraries/server/#api-createStaticHandler) is a smaller handler that only confines the path, refuses symlinks and sets a content type, with no pipeline behind it. Every export, option and type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/server/#api-reference).

## Limitations

- Steps are synchronous and a file is read whole before it is answered. There is no streaming and there are no range requests, so it is not the server for very large files.
- The built-in pipeline answers GET and HEAD only, and a step never sees a request body.
- The plan arrives resolved: an absolute root, a concrete port and the header rules in their final order. Nothing here reads a config file or applies defaults.
- The only caching header set for you is the entity tag. A cache lifetime is a header rule you write.
- No security header is sent unless the plan carries it. A page with no embedders declared can be framed by any origin.
- No symlink below the root is followed, but a hard link is a file like any other and is served. A writer who can swap a directory for a link between the check and the read is outside what a path check can stop, so keep the served directory writable by the deployment alone.
- The server speaks plain HTTP. Terminate TLS in a proxy in front of it.

## Compatibility

Support is per entry point. The root entry is the HTTP kernel and runs on Node.js 18 or later only. The [`/policy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/) entry imports no Node.js built-in, so it also runs in a browser or a web worker once a bundler includes it; the package publishes no browser bundle of its own.

<!-- hf:media start id="runtimes" scene="runtimes-server" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, with partial support in evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ⚠️     |
| Web Workers     |    ⚠️     |

<!-- hf:media end -->

| Operating System | Supported |
| ---------------- | :-------: |
| Linux            |    ✅     |
| macOS            |    ✅     |
| Windows          |    ✅     |

### Output Formats

| Format | File        | Tree-Shakeable |
| ------ | ----------- | :------------: |
| ESM    | `index.mjs` |       ✅       |
| CJS    | `index.cjs` |       ❌       |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/server)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
