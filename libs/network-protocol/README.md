# @hyperfrontend/network-protocol

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-network-protocol.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-network-protocol.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=network-protocol">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=network-protocol" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/network-protocol">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/network-protocol?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/network-protocol">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fnetwork-protocol?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/network-protocol">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/network-protocol?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/network-protocol/">
    <img width="640" src="https://www.hyperfrontend.dev/media/network-protocol-frame/hero.gif" alt="One channel.send call drawn as a row of coloured byte cells filling in left to right: version 1B, type 1B, counter 8B, sealed packet 37B, tag 16B, ending with a replayed frame reported as onDrop code 'replayed'">
  </a>
</p>
<p align="center">
  <sub>One frame, byte by byte. Ten of them travel in the clear and the tag covers those ten too, so a captured frame cannot be edited and a replay of it never reaches your handler.</sub>
</p>

Production-grade network protocol for secure, real-time cross-window and cross-process communication with a session-keyed authenticated envelope, routing, and message queueing.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/network-protocol/)
• 👉 See [**API reference**](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-reference)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fnetwork-protocol)

## What is @hyperfrontend/network-protocol?

You already have a transport: a WebSocket, `postMessage` to another window or a worker, a Node IPC pipe. What you do not have is the envelope to put on it. That is this library. Hand it a function that transmits bytes, a callback for delivered messages, a protocol provider, and the session the two ends agreed on, and you get a channel back.

Each end mints a random nonce and an ephemeral P-256 key pair, advertises them in a 99-byte hello frame, and derives two AES-GCM-256 keys from the agreement, one per direction. Every message is sealed under the sending key with a counter that serves as the nonce and as the replay check; every inbound frame is opened under the receiving key and arrives as a typed packet with an origin, a target, and a payload that has already been checked for the fields it claims to have.

Two protocols share that wire format. `v3` keys the session from the agreement alone, which defeats anything that can only listen. `v4` mixes a pre-shared key into the schedule, stretched once per session, so a script without the key can neither read frames nor produce frames the counterpart accepts.

Outbound and inbound are each one FIFO stage that finishes a frame before pulling the next, so the async crypto cannot reorder your sends, and either direction can be stopped and resumed. A frame that fails to open (replayed, forged, malformed, from another session) is dropped inside its stage, reported through `onDrop` with a machine-readable code, and leaves the rest of the pipeline running.

Most projects should not start here. For typed, contract-checked messages between windows, use [@hyperfrontend/nexus](https://www.hyperfrontend.dev/docs/libraries/nexus/), which registers this library's exports as a security provider and owns the handshake, the origin policy, the hello retries, and the connection lifecycle. To compose whole applications into a host page, use [@hyperfrontend/features](https://www.hyperfrontend.dev/docs/libraries/features/), which sits above nexus. Come here directly when you own the transport and want the envelope on your own terms.

At a glance, the page side of a page-to-worker link:

```typescript
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createData, deserializeData } from '@hyperfrontend/network-protocol/browser/data'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v3'

const worker = new Worker('./peer.js')
const pageId = crypto.randomUUID()
const workerId = crypto.randomUUID()

const channel = createChannel('worker-bridge', {
  send: (frame) => worker.postMessage(frame, [frame.buffer]), // your transport, outbound
  receive: (packet) => render(packet.origin, packet.data.message), // opened, validated, in order
  protocolProvider: createProtocol(logger),
  session: {
    protocol: 'v3',
    role: 'initiator',
    localId: pageId,
    peerId: workerId,
  },
})

worker.addEventListener('message', ({ data }) => {
  if (channel.isHello(data))
    channel.acceptHello(data) // the worker's public material keys the session
  else channel.receive(data) // everything else is a sealed frame
})
worker.postMessage(await channel.hello()) // this side's public material, in the clear by design

// pid is a UUID v4 naming the conversation, 1 is the step number within it
const pid = crypto.randomUUID()
const data = deserializeData(await createData(pid, 1, { type: 'PING' }))
channel.send(pageId, workerId, data) // waits inside the seal stage until the worker's hello has arrived
```

The worker mirrors this with `role: 'responder'` and the two identities swapped; how the identities reach it is up to your transport (nexus carries them in its handshake).

### Key Features

- **Session-keyed authenticated envelope** - Each session is keyed from an ephemeral P-256 agreement, expanded with HKDF-SHA256 into one AES-GCM-256 key per direction; every frame carries its header as additional authenticated data
- **Two protocols, one wire format** - `v3` keys the session from the agreement alone; `v4` mixes in a pre-shared key stretched once per session with PBKDF2-SHA256 (600,000 iterations)
- **Replay rejection before decryption** - Frame counters start at 1 and must increase; a frame whose counter is not above the last accepted one is refused before any key is touched
- **One-shot sessions** - The first hello keys the session, a repeat of it is a duplicate, anything else is rejected, and a live session is never rekeyed
- **Isomorphic design** - Identical APIs for browser (`postMessage`) and Node.js (IPC); a browser-composed side and a Node-composed side produce identical frames and interoperate
- **Ordered pipelines** - One seal stage outbound and one open stage inbound, each an array-backed FIFO that finishes a frame before pulling the next, with independent stop/resume
- **Drop reporting** - `onDrop` receives every packet either stage discards, with the direction, the stage, the reason, and the protocol error that caused it
- **Machine-readable errors** - Six protocol error codes (`unsupported-version`, `replayed`, `authentication-failed`, `malformed`, `counter-exhausted`, `invalid-session`) survive the drop report
- **Topic-based routing** - Pub/sub message distribution with dynamic subscription resolution and WeakMap-based channel tracking
- **Channel management** - Named channels with UUID tracking, lifecycle control (stop/resume), and per-direction queue depth
- **Schema validation** - Each message carries a generated JSON Schema and a hash of it, so the receiver can check the shape it was sent

### Architecture Highlights

The key schedule binds both nonces, both public keys, the protocol id, and both identities into the derived keys, so a frame from any other session fails to authenticate. The cost is one ECDH agreement plus one HKDF expansion per direction per session (plus one PBKDF2 stretch for `v4`), then one AES-GCM operation per message in each direction; the stretch runs once, when the session is keyed, so it lands on the handshake and not on traffic.

The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/network-protocol/architecture/) works through the hello exchange, the wire format, the injected platform primitives, and what each protocol does and does not claim.

## Why Use @hyperfrontend/network-protocol?

### You own the transport and do not want to invent the envelope

Raw `postMessage` and IPC give you bytes and nothing else. Everything above them is yours to build: a key exchange, a framing format, replay protection, something that stops two overlapping crypto calls from delivering your messages out of order, and a shape check so a malformed payload never reaches a handler. That layer is small enough to write and easy to get subtly wrong. It is the part this library ships, and it is the only part it ships. Your socket, your window, your pipe stays yours.

### A real key schedule, and you can read all of it

Each side contributes a 32-byte nonce and an ephemeral P-256 public key in its hello. The salt is the two nonces in role order, the input key material is the ECDH shared secret (`v3`) or the shared secret followed by a PBKDF2 stretch of the pre-shared key (`v4`), and two keys come out of HKDF-SHA256 under info strings that name the protocol and both identities. Each side seals with its own direction's key and opens with the other's, raw material is zeroed after derivation, and the AES-GCM nonce is the frame counter, unique by construction. What each protocol promises is stated claim by claim in the [architecture guide](https://www.hyperfrontend.dev/docs/libraries/network-protocol/architecture/); neither hides the hello, because public keys and nonces are public by design.

### Ordering and backpressure come from the queues, not from a promise

Each direction is one FIFO stage that awaits one frame before pulling the next, so crypto timing cannot shuffle your sends and the replay counter stays exact. `channel.stop()` pauses both directions, `channel.resume()` drains them, and `channel.outbound.queue.size` tells you how far behind you are. Failures are contained: a packet that will not seal or a frame that will not open fails inside its stage, goes to the logger you injected and to `onDrop`, and the channel keeps running.

### The same code in a browser and in Node

`/browser/*` and `/node/*` export the same functions with the same signatures. Only the crypto and text-codec injection differ, so an Electron main process and its renderer, or a page and a worker, can share channel and routing code and swap one import. A session keyed by a browser-composed initiator and a Node-composed responder works, because both sides derive the same keys from the same bytes.

## Installation

```bash
npm install @hyperfrontend/network-protocol
```

## Requirements

- **Node.js:** 18.0.0 or higher (19+ recommended for stable Web Crypto API support)
- **npm:** 8.0.0 or higher
- **Browser:** Modern browsers with Web Crypto API support

> **Note:** The `/node/*` entry points depend on `@hyperfrontend/cryptography` which uses `webcrypto.subtle`. This API was experimental in Node.js 18.x. For production use with Node.js entry points, Node.js 19+ is recommended.

## Quick Start

A session needs two things agreed before it starts: which side is the `initiator` and which the `responder`, and the two identities (`localId` on one side is `peerId` on the other). Both are bound into the derived keys. Identities are public; here the host picks them and tells the guest in plaintext.

### Browser: cross-window messages with v4

The host, in the top window:

```typescript
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createData, deserializeData } from '@hyperfrontend/network-protocol/browser/data'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v4'

const guest = document.querySelector('iframe').contentWindow
const guestOrigin = 'https://app.example.com'
const hostId = crypto.randomUUID()
const guestId = crypto.randomUUID()

// createProtocol(logger, sharedKey) returns a provider; the key must be at least 16 characters and should be generated, not chosen
const channel = createChannel('window-link', {
  send: (frame) => guest.postMessage(frame, guestOrigin, [frame.buffer]),
  receive: (packet) => console.log('from', packet.origin, packet.data.message),
  protocolProvider: createProtocol(logger, sharedKey),
  session: {
    protocol: 'v4',
    role: 'initiator',
    localId: hostId,
    peerId: guestId,
  },
})

window.addEventListener('message', ({ origin, data }) => {
  if (origin !== guestOrigin) return
  if (channel.isHello(data)) channel.acceptHello(data)
  else channel.receive(data)
})

guest.postMessage({ hostId, guestId }, guestOrigin) // identities, in the clear
guest.postMessage(await channel.hello(), guestOrigin) // public material, in the clear

// the pid stays the same across the steps of one conversation, the sequence number counts them
const pid = crypto.randomUUID()
const data = deserializeData(await createData(pid, 1, { greeting: 'Hello' }))
channel.send(hostId, guestId, data) // sealed once the guest's hello has keyed the session

// pause and drain either direction
channel.stop()
channel.resume()
```

The guest, inside the iframe:

```typescript
import type { Channel } from '@hyperfrontend/network-protocol/browser/channel'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v4'

const hostOrigin = 'https://host.example.com'
let channel: Channel | null = null

window.addEventListener('message', ({ origin, data }) => {
  if (origin !== hostOrigin) return
  if (channel === null) {
    // the first message carries the identities; everything after it is a frame
    const { hostId, guestId } = data
    channel = createChannel('window-link', {
      send: (frame) => window.parent.postMessage(frame, hostOrigin, [frame.buffer]),
      receive: (packet) => console.log('from', packet.origin, packet.data.message),
      protocolProvider: createProtocol(logger, sharedKey),
      session: {
        protocol: 'v4',
        role: 'responder',
        localId: guestId,
        peerId: hostId,
      },
    })
    channel.hello().then((hello) => window.parent.postMessage(hello, hostOrigin))
    return
  }
  if (channel.isHello(data)) channel.acceptHello(data)
  else channel.receive(data)
})
```

A guest holding a different key derives different keys: every frame from the host fails to authenticate and is reported through `onDrop` with code `authentication-failed`, and nothing is delivered.

### Node.js: the same channel between threads with v3

The main thread:

```typescript
import { randomUUID } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/node/channel'
import { createData, deserializeData } from '@hyperfrontend/network-protocol/node/data'
import { createProtocol } from '@hyperfrontend/network-protocol/node/v3'

const mainId = randomUUID()
const workerId = randomUUID()
const worker = new Worker('./worker.js', { workerData: { mainId, workerId } })

const channel = createChannel('thread-link', {
  send: (frame) => worker.postMessage(frame, [frame.buffer]),
  receive: (packet) => handle(packet.data.message),
  protocolProvider: createProtocol(logger),
  session: {
    protocol: 'v3',
    role: 'initiator',
    localId: mainId,
    peerId: workerId,
  },
})

worker.on('message', (frame: Uint8Array) => (channel.isHello(frame) ? channel.acceptHello(frame) : channel.receive(frame)))
worker.postMessage(await channel.hello())

const data = deserializeData(
  await createData(randomUUID(), 1, {
    job: 'resize',
    file: 'a.png',
  })
)
channel.send(mainId, workerId, data)
```

The worker (`worker.js`):

```typescript
import { parentPort, workerData } from 'node:worker_threads'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/node/channel'
import { createProtocol } from '@hyperfrontend/network-protocol/node/v3'

const { mainId, workerId } = workerData

const channel = createChannel('thread-link', {
  send: (frame) => parentPort.postMessage(frame, [frame.buffer]),
  receive: (packet) => handle(packet.data.message),
  protocolProvider: createProtocol(logger),
  session: {
    protocol: 'v3',
    role: 'responder',
    localId: workerId,
    peerId: mainId,
  },
})

parentPort.on('message', (frame: Uint8Array) => (channel.isHello(frame) ? channel.acceptHello(frame) : channel.receive(frame)))
parentPort.postMessage(await channel.hello())
```

Hello frames are posted by copy and sealed frames by transfer: the protocol hands out the same hello bytes on every call, so a transport may re-post it until the counterpart answers, while each sealed frame owns its buffer and is never needed again once sent.

## API Overview

Nothing is exported from the package root: every import names a subpath, and the subpaths sit on two axes. One is the platform that supplies the crypto and text primitives, `/browser` or `/node`. The other is the protocol version that keys the session, `/v3` or `/v4`. A browser subpath and its Node twin export the same names with the same signatures, and a session between the two works because both sides derive their keys from the same bytes, so moving code between a page and a worker, or between a renderer and a main process, is an edit to the import path and nothing else.

Two calls get a link running. [`createProtocol`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v3/#api-createProtocol) takes your logger, and on `/v4` the pre-shared key as well, and hands back a provider. [`createChannel`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/channel/#api-createChannel) takes a label and an options object holding the `send` and `receive` callbacks that reach your transport, that provider, and the session the two ends agreed on.

```typescript
const channel = createChannel(label, {
  send,
  receive,
  protocolProvider,
  session,
  onDrop,
})
// session: { protocol: 'v3' | 'v4', role: 'initiator' | 'responder', localId, peerId }
```

What comes back is a [`Channel`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/channel/#api-Channel), and for most code it is the only object in play: the hello exchange your transport carries, `send(origin, target, data)` for traffic, `stop` and `resume` for both directions at once, and `outbound` and `inbound` for per-direction queue depth. Nothing rejects. A frame that will not seal or will not open is dropped inside its own stage and reported to your `onDrop` as a [`PacketDrop`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/channel/#api-PacketDrop), while the rest of the pipeline keeps running.

The version is the security decision, and it is the only thing that differs between `/v3` and `/v4`. `v3` keys the session from the ephemeral agreement alone, which defeats anything that can only listen but says nothing about who the counterpart is. `v4` mixes in a pre-shared key, stretched once when the session is keyed, so a script without that key can neither read frames nor produce frames the far side accepts; it carries two extra exports for that key, [`isValidSharedKey`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v4/#api-isValidSharedKey) and `MIN_SHARED_KEY_LENGTH`, and otherwise mirrors `/v3`.

Four subpaths name no platform because they hold no crypto. `/queue` is the FIFO stage both pipelines are built from, `/routing` and `/topic` are the pub/sub layer that names message categories and decides which channels a topic's messages reach, and `/security` holds the session types and the six [`ProtocolErrorCode`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/security/#api-ProtocolErrorCode) values a drop can carry. The remaining per-platform subpaths are for taking one piece rather than a whole channel: `/data` builds the message envelope, stamping a conversation id, a sequence number and a schema hash onto your payload, `/packet` holds the packet builders and validators, and `/sender` and `/receiver` are the outbound and inbound halves on their own.

Every option, type and validator is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-reference).

## Documentation

### Comprehensive Guides

- **[ARCHITECTURE.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/ARCHITECTURE.md)** - In-depth architecture guide with composition diagrams, the hello exchange, the key schedule, the wire format, and a "How Do I..." quick reference
- **[src/lib/README.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/README.md)** - Module index with links to all subdomain documentation

### Module Documentation

Each module has its own README with purpose, interfaces, factory functions, and usage examples:

| Module        | Description                                                   | Documentation                                                                                                       |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **channel/**  | Bidirectional communication channels                          | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/channel/README.md)  |
| **packet/**   | Plaintext packets, wire frames, and drop reports              | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/packet/README.md)   |
| **protocol/** | Session protocol: hello exchange, key schedule, seal and open | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/protocol/README.md) |
| **security/** | Session types, hello outcome, and protocol error codes        | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/security/README.md) |
| **queue/**    | FIFO seal and open queues                                     | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/queue/README.md)    |
| **sender/**   | Outbound pipeline                                             | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/sender/README.md)   |
| **receiver/** | Inbound pipeline                                              | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/receiver/README.md) |
| **data/**     | Structured message payloads                                   | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/data/README.md)     |
| **routing/**  | Topic-based message routing                                   | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/routing/README.md)  |
| **topic/**    | Topic store management                                        | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/topic/README.md)    |

### Platform Entry Points

- **[src/browser/README.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/browser/README.md)** - Browser platform documentation
- **[src/node/README.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/node/README.md)** - Node.js platform documentation

### Integration Tests

Living documentation through executable examples:

- `src/integration-tests/session-envelope.browser.spec.ts` - Two channels wired in memory over `v3` and `v4`: delivery in both directions, only sealed bytes on the wire, order across a burst, replay and foreign-session rejection reported as drops, a key mismatch delivering nothing, and a browser-composed side talking to a Node-composed side
- `src/integration-tests/harness.ts` - `connectPair`, which runs the hello exchange between two providers exactly as a transport would route it

## Compatibility

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ✅    |
| Web Workers                   |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |

### Output Formats

| Format | File                                                         | Tree-Shakeable |
| ------ | ------------------------------------------------------------ | :------------: |
| ESM    | `index.esm.js` under each entry                              |       ✅       |
| CJS    | `index.cjs.js` under each entry                              |       ❌       |
| IIFE   | `bundle/v3/index.iife.min.js`, `bundle/v4/index.iife.min.js` |       ❌       |
| UMD    | `bundle/v3/index.umd.min.js`, `bundle/v4/index.umd.min.js`   |       ❌       |

### CDN Usage

This library provides **separate bundles for each protocol**; the package's default CDN file is the `v4` UMD bundle:

```html
<!-- v4 (the package default) -->
<script src="https://unpkg.com/@hyperfrontend/network-protocol/bundle/v4/index.umd.min.js"></script>

<!-- v3 -->
<script src="https://unpkg.com/@hyperfrontend/network-protocol/bundle/v3/index.umd.min.js"></script>

<script>
  // v4
  const { createProtocol: createV4 } = HyperfrontendNetworkProtocolV4

  // v3
  const { createProtocol: createV3 } = HyperfrontendNetworkProtocolV3
</script>
```

**Global variables:** `HyperfrontendNetworkProtocolV3`, `HyperfrontendNetworkProtocolV4`

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/network-protocol)**

- Uses [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography) for the key agreement, key derivation, password stretching, and AES-GCM sealing
- For simpler cross-window messaging with contracts, see [@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/nexus)

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
