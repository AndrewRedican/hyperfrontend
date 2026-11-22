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

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/server/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/server-hairpin/hero.gif" alt="A process drawn as a shell with a way in and a way out, its three steps standing inside as panes under the chips health, cors and router, with two lanes crossing all three; a request enters as a hollow ring, comes round a turn inside the router pane and returns along the lower lane as a solid value, gaining a band as it passes back through cors, while another is turned round by health and never reaches the others; then SIGTERM climbs a wire to the runService chip, the way in swings shut, a request that arrives after it stops outside and fades, the two still inside come round and leave, and only then the panes go dark and a 0 drops down the wire into the slot beneath">
  </a>
</p>

A small HTTP kernel for Node.js: a service is a list of steps that return responses, run as a process with fixed exit codes, one started line and a graceful stop.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/server/)

• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fserver)

## What is @hyperfrontend/server?

[`@hyperfrontend/server`](https://www.hyperfrontend.dev/docs/libraries/server/) is a library for writing a Node.js HTTP service and running it as a process. A request is answered by an ordered list of steps: functions, like middleware, that return a response value instead of writing one. [`runService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-runService) then runs that service as a process: it reads a declared environment, prints one started line, drains the requests in flight when it is asked to stop, and exits with a code a supervisor can act on.

It answers a request in one of two ways, called contracts here:

| Contract                     | Use it for                                                                                   | Start with                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service: steps may wait      | Anything that routes, reads a request body, waits on something else or streams its response  | [`startService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-startService), [`runService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-runService) |
| Static: steps answer at once | A built site served from a directory, with compression, entity tags and header rules by path | [`startStaticServer`](https://www.hyperfrontend.dev/docs/libraries/server/#api-startStaticServer)                                                                            |

A service that also serves files mounts the static pipeline as one of its steps with [`staticFiles`](https://www.hyperfrontend.dev/docs/libraries/server/#api-staticFiles). To serve a built micro-frontend from the command line, use `hf serve` from [`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/server/): it is built on the static contract, and finds the config and works out the root and the header rules for you.

It is not a web framework. There are no sessions, templates or body schemas, it does not run Express or Connect middleware, and it loads no configuration file. It speaks plain HTTP/1.1, with no HTTP/2 and no WebSocket upgrade: TLS ends in a proxy in front of it.

### Key Features

- **Steps that return responses** - A step answers or calls the next one; to fail it throws a status, and the client receives that status and none of the error's text
- **A runner for the whole process** - Reads the environment, prints one started line, drains on a signal or a fault, and exits with one of three codes
- **Declared environment** - Variables declared as data and read into typed values, with every problem reported at once and no value echoed
- **Bounded by default** - Body size, the time to receive a request, idle connections, stalled writes and the shutdown grace each have a default limit
- **Router with typed params** - Path patterns with params and a trailing wildcard, typed into the handler, with 404 told apart from 405
- **Bodies and streams** - A request read as bytes, JSON or a stream under a byte limit, and a response sent as a buffer or a stream with backpressure
- **Health, readiness and CORS** - Ready-made steps for platform probes and browser preflights
- **Static file serving** - Brotli or gzip, entity tags with 304, directory indexes, and 404 for dotfiles and symlinked paths
- **Header policy as data** - Ordered header rules, with who may embed the site in a frame and cross-origin isolation as fields, not headers spelled by hand
- **Release manifest** - An index of a built artifact's files by SHA-256 with one digest for the release, so a partial or changed deployment can be caught

### Architecture Highlights

- **A service's request target is canonical before any step runs**: a path is decoded once, and an encoded separator, a dot segment or a control character answers 400, so a guard, the router and a mounted site all judge the same path.
- **A failing request does not stop the process**: a step that throws, a step that returns something other than a response and a stream that fails are each contained to their own request.
- **A service sends and logs nothing a failed request says**: the client gets the status's reason phrase, and the log gets a code and the error's name, never its message.
- **Process effects live in one function**: only [`runService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-runService) listens for faults, writes to the standard streams and ends the process. [`startService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-startService) touches none of them, and [`waitForShutdown`](https://www.hyperfrontend.dev/docs/libraries/server/#api-waitForShutdown), for a server started by hand, only waits for a signal.
- **The served root confines every path**: nothing outside the root is served, no symlink below it is followed, and a dotfile stays hidden under any spelling the file system accepts.
- **A header rule cannot corrupt a response**: the pipeline owns the headers that describe the body, such as its length and encoding, and a rule written for a page never makes the 500 of a step that threw cacheable.

The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/server/architecture/) covers the flow of one request, the runner and its lines, every bound, and how header rules fold.

## Why Use @hyperfrontend/server?

A framework such as Express or Fastify answers requests and leaves the process around them to each service: reading the environment, handling signals, draining on a stop and choosing an exit code. This package covers both in one dependency, and leaves out what a framework adds: sessions, templates, body schemas and a plugin ecosystem. It does not replace a supervisor or a container's restart policy; it gives one something to act on.

### A process a supervisor can read

Three exit codes and one started line, the same for every service: 0 for a stop that was asked for and closed with no fault, 78 for a deployment that cannot start as it is, such as a missing variable, and 1 for everything else. An unhandled rejection is neither swallowed nor an instant death: the requests in flight are drained and the process exits 1.

### Logs that leave request data out

A service logs a routed request by its route's name, not its path, and never with its query. A failed request names the error's class and nothing the error says. A problem with the environment names the variable and what was expected, never the value, and a secret read from the environment prints as a mask. Each line is an event handed to a function you supply, so it can go to a logger of your own. For a service, the two cases where a path or a message still reaches the log are under [Limitations](#limitations). The static server's log is an access log: it prints each request's path.

### Headers a reviewer can read

What a deployment sends is a list of rules in a plain object: which paths, which headers, in which order. Who may frame a page and whether it is cross-origin isolated are one field each. Every problem in a header policy is reported at once, when the policy is expanded, not on the first request that matches a rule.

### A pipeline you can test without a port

A step is a function from a request value to a response value. The file reads, the clock, the event sink and the process itself are parameters, so a test runs a pipeline over an in-memory site and drives a whole service through its stop without a signal being sent.

### Nothing else to install

The published package installs no other package and needs no other part of hyperfrontend.

## Installation

```bash
npm install @hyperfrontend/server
```

Requires Node.js 18 or later.

## Quick Start

### A service

A service is two files: a definition, which a test can import, and a main that runs it. [`defineService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-defineService) pairs the environment with a start function, [`startService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-startService) listens, and [`runService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-runService) runs the definition as the process. This one reads a port and a greeting from the environment, and answers one route and the two probes:

```typescript
// service.ts
import { defineService, health, jsonResponse, readiness, route, router, startService } from '@hyperfrontend/server'
import { asPort, asText, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'

let listening = false

export const service = defineService({
  environment: defineEnvironment({
    http: { PORT: optional(asPort(), 8080) },
    hello: { HELLO_GREETING: required(asText()) },
  }),
  async start(values, context) {
    const greet = route('GET', '/hello/:name', (request) =>
      jsonResponse(200, { message: `${values.hello.HELLO_GREETING}, ${request.params.name}` })
    )
    const ready = readiness({ checks: { listening: () => listening } })
    const handle = await startService(
      {
        port: values.http.PORT,
        steps: [health(), ready, router({ greet })],
      },
      { report: context.report }
    )
    listening = true
    return handle
  },
})
```

```typescript
// main.ts
import { runService } from '@hyperfrontend/server'
import { service } from './service.js'

void runService(service)
```

Compile it and start the main with `node` directly, since a package script does not pass a terminate signal on:

```bash
HELLO_GREETING=Hello node main.js
```

Asked for `/hello/world` and then sent a terminate signal, it prints this on standard output and exits with code 0. The request line is there because the start function passed the runner's report function on to the service:

```text
started port=8080
request method=GET route=greet status=200 outcome=sent ms=2
stopping cause=signal signal=SIGTERM
stopped
```

Started without the greeting it prints one block on standard error, starts nothing and exits with code 78:

```text
fatal cause=environment
  - HELLO_GREETING (hello) is missing; expected non-empty text.
```

The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/server/architecture/#the-runner) has every line the runner prints and what each signal does on each platform.

### A static server

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

[`expandHeaderPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-expandHeaderPolicy) turns the declared fields into header rules, and throws when a rule is malformed or a source would let every origin frame the site. The access log needs both of its halves: `log: true` turns it on, and the function says where its lines go. The [`/policy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/) page covers the fields and the presets.

## API Overview

| Entry                                                                              | What it holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@hyperfrontend/server`](https://www.hyperfrontend.dev/docs/libraries/server/)    | Both contracts and the runner: [`startService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-startService), [`router`](https://www.hyperfrontend.dev/docs/libraries/server/#api-router), [`route`](https://www.hyperfrontend.dev/docs/libraries/server/#api-route), the ready-made steps, [`runService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-runService), [`defineService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-defineService) and [`startStaticServer`](https://www.hyperfrontend.dev/docs/libraries/server/#api-startStaticServer). Node.js only |
| [`/environment`](https://www.hyperfrontend.dev/docs/libraries/server/environment/) | The environment a service reads, declared as data: [`defineEnvironment`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-defineEnvironment) and readers such as [`asPort`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asPort) and [`asSecret`](https://www.hyperfrontend.dev/docs/libraries/server/environment/#api-asSecret). Imports no Node.js built-in, so it also runs in a browser                                                                                                                                                                  |
| [`/manifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/)       | The release manifest `hf-release.json`: [`createReleaseManifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-createReleaseManifest) indexes a directory and [`verifyRelease`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-verifyRelease) checks one against it. Node.js only                                                                                                                                                                                                                                                                                |
| [`/policy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/)           | The serve config as data: [`defineServeConfig`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-defineServeConfig), [`expandHeaderPolicy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/#api-expandHeaderPolicy) and the header presets. Imports no Node.js built-in, so it also runs in a browser                                                                                                                                                                                                                                                                         |

Every export, option and type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/server/#api-reference).

## Limitations

- **Plain HTTP/1.1, behind a proxy.** TLS ends in the proxy by design. There is no cap on connections and no compression of routed responses either, so those are the proxy's as well. Set [`keepAliveTimeoutMs`](https://www.hyperfrontend.dev/docs/libraries/server/#api-ServiceOptions-prop-keepAliveTimeoutMs) above the proxy's idle timeout, and the supervisor's wait between terminate and kill above [`stopTimeoutMs`](https://www.hyperfrontend.dev/docs/libraries/server/#api-ServiceDefinition-prop-stopTimeoutMs).
- **Static files are read whole and synchronously.** There is no streaming and there are no range requests, so it is not the server for very large files, and the entity tag is a file's size and modification time.
- **A handler has no deadline unless its route sets [`timeoutMs`](https://www.hyperfrontend.dev/docs/libraries/server/#api-RouteOptions-prop-timeoutMs).** A default would cut a long upload, so there is none, and cancellation is cooperative: a handler that ignores its signal keeps running after its response is gone.
- **A service's request targets are strict.** An encoded slash, a doubled slash, a dot segment and a raw byte above ASCII are refused with 400, not normalised, so that a guard and the router always judge the same path. The static server resolves them under its root.
- **No security header is sent unless you declare it.** A site served with no embedders declared can be framed by any origin.
- **A graceful stop needs the signal to arrive.** A package script does not pass it on: `npm run` exits and leaves the service running on its port. On Windows only a console event or a closed IPC channel stops a service gracefully.
- **A path can still reach the log.** A request no route claimed, a 401 from a step ahead of the router included, is logged by its path, so a secret never goes in a path.
- **A failed start prints its error's message.** A start function that hands a secret to a parser or a client should catch around the call and throw a message of its own.
- **The release manifest is not a signature.** It catches a partial or changed deployment, not someone who can rewrite the manifest beside the files.
- **[`cors`](https://www.hyperfrontend.dev/docs/libraries/server/#api-cors) is not an access control.** It tells a browser which origins may read a response; a request from any other origin still runs. Decide who may call a route in a step of your own.

The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/server/architecture/) lists every bound and what each contract leaves out.

## Compatibility

Support is per entry point. The root entry, which holds both contracts and the runner, and the [`/manifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/) entry run on Node.js 18 or later only. The [`/policy`](https://www.hyperfrontend.dev/docs/libraries/server/policy/) and [`/environment`](https://www.hyperfrontend.dev/docs/libraries/server/environment/) entries import no Node.js built-in, so they also run in a browser or a web worker once a bundler includes them; the package publishes no browser bundle of its own.

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
