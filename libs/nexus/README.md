# @hyperfrontend/nexus

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-nexus.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-nexus.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=nexus">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=nexus" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/nexus">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/nexus?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/nexus">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fnexus?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/nexus">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/nexus?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/nexus/">
    <img width="640" src="https://www.hyperfrontend.dev/media/nexus-handshake/hero.gif" alt="Two panels, host-app on shop.example.com and cart-app on cart.example.com, trading labelled packets along a wire: the three handshake frames, then THEME_CHANGED and CART_UPDATED, then a PRICE_SYNC the host never accepted, which arrives and is dropped">
  </a>
</p>
<p align="center">
  <sub>The three handshake frames in their real order, then the first message that falls outside the contract: it crosses, it lands, and no handler runs.</sub>
</p>

Secure cross-window communication library for micro-frontends with contract-validated messaging, origin-based security policies, and connection lifecycle management.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/nexus/)

• 👉 See [**API reference**](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-reference)

• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fnexus)

## What is @hyperfrontend/nexus?

Two windows talking over `postMessage` share a string and nothing else: no agreement on which message types exist, no way to tell whether anyone is listening, no signal when the other side goes away. Nexus puts a broker in front of that. One broker per app manages a channel per counterpart window or frame, and every channel carries a contract, the message types each side sends and accepts, exchanged during a three-way handshake. Types outside the contract are dropped, messages from an origin other than the pinned one are ignored, and the connection state is something you subscribe to instead of infer.

```typescript
import { createBroker } from '@hyperfrontend/nexus'

const broker = createBroker({
  name: 'host-app',
  contract: { emitted: [{ type: 'THEME_CHANGED' }], accepted: [{ type: 'CART_UPDATED' }] },
  settings: { whitelist: ['https://cart.example.com'] },
})

const cart = broker.addChannel('cart', cartFrame.contentWindow)
cart.on('open', () => cart.send('THEME_CHANGED', { theme: 'dark' }))
cart.onMessage(({ type, data }) => console.log(type, data))
cart.connect()
```

### Key Features

- **[Contract-Validated Messaging](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract)**: define accepted and emitted message types, with optional JSON Schemas carried for consumers to validate payloads against
- **[Broker-Channel Architecture](https://www.hyperfrontend.dev/docs/libraries/nexus/architecture/#architecture-overview)**: a central broker manages multiple independent channels to different windows
- **[Origin-Based Security](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerSettings)**: whitelist/blacklist filtering plus custom security policy functions
- **[Connection Lifecycle Management](https://www.hyperfrontend.dev/docs/libraries/nexus/architecture/#protocol-design)**: full state machine for connect, disconnect, cancel, deny, and destroy operations
- **[Event Subscription System](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent)**: subscribe to lifecycle events (open, close, cancel, deny, invalid, connect-timeout, security events) and user messages
- **Message Queueing**: messages sent before a channel is active are queued, not lost
- **[Contract Extension & Merging](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-mergeContracts)**: extend contracts at runtime or merge several into one
- **Functional API Design**: factory functions with closure-based encapsulation, no class hierarchy to subclass

## Why Use @hyperfrontend/nexus?

Micro-frontend integrations fail where two teams assumed different message shapes. A contract makes the assumption a value both sides exchange and the runtime enforces:

```typescript
const contract: IChannelContract = {
  emitted: [{ type: 'USER_UPDATED', schema: userJsonSchema }, { type: 'NAVIGATION_REQUEST' }],
  accepted: [{ type: 'USER_DATA' }, { type: 'NAVIGATION_COMPLETE' }],
}
```

Unknown inbound types are dropped and logged, and an [`accepted`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract-prop-accepted) entry marked `required: true` denies the handshake outright when the counterpart cannot emit it. Adding actions stays backward compatible either way.

Origin checks come with it. A [`whitelist`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerSettings-prop-whitelist)/[`blacklist`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerSettings-prop-blacklist) pair on the broker settings, or `broker.setSecurityPolicy((event) => event.origin.endsWith('.example.com'))`, vets requests before the channel opens, so no message handler has to remember to test [`event.origin`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent/origin) itself.

One broker holds many channels, which is what a host coordinating several micro-apps needs: call [`addChannel`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerHandle) per frame, then loop the handles to connect or broadcast. Each channel runs its own handshake and lifecycle, so a frame that never answers cannot stall the others, and messages sent before a channel goes active are queued rather than dropped.

Handlers stay small. Subscribe to a single lifecycle event with `channel.on('open', handler)`, or replace a switch over message types with one filtered subscription per type:

```typescript
import { byType, compose, createMessageFilter } from '@hyperfrontend/nexus'

channel.onMessage(byType('USER_LOGIN')(handleLogin))
channel.onMessage(byType('USER_LOGOUT')(handleLogout))
channel.onMessage(byType('DATA_SYNC')(handleSync))

// compose narrows a single subscription: a message must pass every filter
channel.onMessage(
  compose(
    byType('DATA_SYNC'),
    createMessageFilter((message) => message.data?.priority === 'high')
  )(handleUrgentSync)
)
```

Handshake states, denial reasons, queue behaviour, and the encrypted-envelope negotiation are worked through in the [architecture documentation](https://www.hyperfrontend.dev/docs/libraries/nexus/architecture/).

## Protocol Overview

Nexus implements a **three-way handshake protocol** (REQUEST → ACCEPT → OPEN) for establishing connections, with graceful disconnection, cancellation, denial, and timeout handling. The summaries below map the territory; the [Architecture Documentation](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md) covers every flow in depth.

### Connection Handshake

Initiation is symmetric: either side may call `connect()` first, and simultaneous requests resolve deterministically via a broker-id tie-break. Pending handshake messages are re-sent every [`requestRetryMs`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelSettings-prop-requestRetryMs) (default 500 ms) until answered, and a handshake unanswered past [`connectTimeoutMs`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelSettings-prop-connectTimeoutMs) (default 10 000 ms) fires `connect-timeout`, leaving the channel inactive and reconnectable with its queued messages retained. Each side pins the counterpart's origin during the handshake, and inbound messages from any other origin are dropped. See [Protocol Design](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#protocol-design).

### Contract Compatibility

Contracts are exchanged during the handshake, but vocabulary differences never gate the connection: only [`accepted`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract-prop-accepted) entries flagged `required: true` do (each must appear in the counterpart's [`emitted`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract-prop-emitted) list), so additive contract evolution stays non-breaking in both directions. A contract may also carry an optional [`version`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract-prop-version) string that nexus attaches no semantics to; a [`contractCompat`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelSettings-prop-contractCompat) rule in the channel settings can compare the two contracts and deny the pair before it opens. When the responder's rule rejects an incoming request, the [`deny`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent) event fires with the rule's reason and `reason: 'incompatible-contract'` on both the denying responder and the denied initiator. See [Contract Compatibility](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#contract-compatibility).

### Security Negotiation

Channels can negotiate a sealed envelope during the handshake: register a security provider on the broker (via `broker.registerProtocol(version, provider)` or the [`settings.security.protocols`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerSettings-prop-security) bag) and opt the channel in with `security: { protocol: 'v3' }` or `security: { protocol: 'v4' }`. The initiator's REQUEST advertises that protocol with plaintext as the fallback, the responder's ACCEPT answers with the outcome, and the initiator's OPEN confirms it; a channel that selected a protocol accepts that protocol or plaintext and nothing else.

Each side attaches its transport as it sends its own handshake answer (the responder with ACCEPT, the initiator with OPEN) and posts the session hello right behind that frame, retrying it every [`requestRetryMs`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelSettings-prop-requestRetryMs) until the counterpart confirms. Product traffic, including sends queued before the handshake, leaves as `Uint8Array` frames sealed under the session keys while the handshake actions themselves stay plaintext; once a transport is attached, any other plaintext action is dropped.

The first inbound frame that authenticates confirms the counterpart and fires `security-ready`; a session nothing confirms within [`connectTimeoutMs`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelSettings-prop-connectTimeoutMs) fires `security-error` with code `security-unconfirmed` and closes with `reason: 'security-unconfirmed'`. Negotiation fails open by default, falling back to plaintext with a warning when the counterpart cannot provide the protocol; `mode: 'fail-closed'` denies the connection instead with `reason: 'security-unavailable'`.

The transport seam is public: [`createSecurityTransport`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-createSecurityTransport) plus the [`SecurityTransport`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityTransport) and [`SecurityProvider`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityProvider) types define the boundary a security package implements, and [`@hyperfrontend/network-protocol`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/) ([`v3`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityProtocolVersion): ephemeral session keys agreed over the wire, defeating scripts that can only listen; [`v4`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityProtocolVersion): the same keys bound to a pre-shared key, defeating any script without the key) satisfies it directly. See [Security Model](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#security-model).

### Disconnection & Cancellation

An active channel closes gracefully through a CLOSE/CLOSE_ACKNOWLEDGED exchange, firing [`close`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent) on both sides; a pending connection can be abandoned by either party through CANCEL/CANCEL_ACKNOWLEDGED, firing [`cancel`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent). Denials (DENY_CONNECTION) and protocol violations (INVALID_REQUEST) round out the failure verbs, and every connection attempt ends in exactly one of [`open`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent), [`close`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent), [`cancel`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent), [`deny`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent), or `connect-timeout`. See [Protocol Design](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#protocol-design).

### Security Policies

What these gates are worth, and which controls sit outside the protocol entirely (`frame-ancestors`, backend authorisation, the pre-shared key), is stated in the [Security Model](https://www.hyperfrontend.dev/docs/core-concepts/security).

Connection-time access control runs before a channel opens: origin [`whitelist`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerSettings-prop-whitelist)/[`blacklist`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerSettings-prop-blacklist) settings filter every inbound message (a non-empty whitelist takes precedence), and a custom policy function, `broker.setSecurityPolicy((event: MessageEvent) => boolean)`, vets requests during handshake handling, with rejected requests answered by DENY_CONNECTION. See [Security Model](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#security-model).

### Logging

All internal output routes through a [`Logger`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-Logger) from [`@hyperfrontend/logging`](https://www.hyperfrontend.dev/docs/libraries/logging/). Set verbosity with the [`logLevel`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerSettings-prop-logLevel) setting (`'error' | 'warn' | 'log' | 'info' | 'debug' | 'none'`) or inject a custom logger (Winston, Pino, etc.) via [`settings.logger`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerSettings-prop-logger); channels inherit the broker's logger, exposed as [`broker.logger`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-BrokerHandle-prop-logger). See [Logging System](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#logging-system).

## Installation

```bash
npm install @hyperfrontend/nexus
```

## Quick Start

```typescript
import { createBroker } from '@hyperfrontend/nexus'

// Define communication contract
const contract = {
  emitted: [{ type: 'PING' }],
  accepted: [{ type: 'PONG' }],
}

// Create broker
const broker = createBroker({
  name: 'main-app',
  contract,
  settings: { logLevel: 'debug' },
})

// Add channel to iframe
const iframe = document.querySelector('iframe')
const channel = broker.addChannel('child-app', iframe.contentWindow)

// Subscribe to messages
channel.onMessage((message) => {
  console.log('Received:', message.type, message.data)
})

// Connect and send
channel.connect()
channel.send('PING', { timestamp: Date.now() })
```

### Using the Default Broker

For quick prototyping, use the pre-configured singleton broker:

```typescript
import { defaultBroker } from '@hyperfrontend/nexus'

const channel = defaultBroker.addChannel('my-channel', targetWindow)
channel.connect()
channel.send('MESSAGE', { hello: 'world' })
```

## API Overview

Everything starts at [`createBroker`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-createBroker). One broker per app: it owns the single [`message`](https://developer.mozilla.org/en-US/docs/Web/API/Window/message_event) listener on your window, holds the contract every channel inherits, and carries the origin whitelist and security policy that apply to all of them. Channels are what you actually hold, one per counterpart window, handed out by `addChannel(name, targetWindow, settings?)` as a [`ChannelHandle`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelHandle). [`defaultBroker`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-defaultBroker) is a ready-made singleton for a prototype that only ever talks to one frame.

A channel does nothing until `connect()`, which starts the three-way handshake. That handshake is where the three things worth having get settled at once: the two [`IChannelContract`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract) values (an [`emitted`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract-prop-emitted) list and an [`accepted`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract-prop-accepted) list of action types) are exchanged, each side pins the counterpart's origin, and the broker's gates vet the request before anything opens. After that the day-to-day surface is two calls. `send(type, data)` throws at the call site for any type outside your own [`emitted`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract-prop-emitted) list, so a typo never travels. `onMessage(handler)` delivers only the types in your own [`accepted`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-IChannelContract-prop-accepted) list; anything else arrives, is logged, and stops there, which is not an event you can subscribe to.

Connection state is an event stream rather than a flag you poll. `channel.on(event, handler)` subscribes to one [`ChannelEvent`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent) and `channel.on(handler)` to all of them; both return an unsubscribe function. Every connection attempt ends in exactly one of [`open`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent), [`close`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent), [`cancel`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent), [`deny`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-ChannelEvent) or `connect-timeout`, and a denial (or a close neither side asked for) carries a machine-readable [`reason`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-DenyEventData) beside its message, so a failure is something you branch on rather than parse.

The rest is opt-in. [`byType`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-byType) and [`compose`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-compose) replace a switch over message types with one narrow subscription per type; [`mergeContracts`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-mergeContracts) folds several contracts into one; and [`createSecurityTransport`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-createSecurityTransport) with the [`SecurityProvider`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityProvider) type is the seam a security package implements, which is how [`@hyperfrontend/network-protocol`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/) supplies the sealed [`v3`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityProtocolVersion) and [`v4`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityProtocolVersion) session envelope.

Every setting, event payload, deny reason and security type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-reference).

## Compatibility

| Platform | Support |
| -------- | :-----: |
| Browser  |   ✅    |
| Node.js  |   ✅    |

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/nexus"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/nexus"></script>

<script>
  const { createBroker, createChannel } = HyperfrontendNexus
</script>
```

**Global variable:** [`HyperfrontendNexus`](https://www.hyperfrontend.dev/docs/libraries/nexus/)

### Peer Dependencies

| Package                         | Version | Type     |
| ------------------------------- | ------- | -------- |
| @hyperfrontend/network-protocol | 2.0.0   | Optional |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/nexus)**

- Optionally uses [@hyperfrontend/network-protocol](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/network-protocol) for the sealed [`v3`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityProtocolVersion)/[`v4`](https://www.hyperfrontend.dev/docs/libraries/nexus/#api-SecurityProtocolVersion) session envelope

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
