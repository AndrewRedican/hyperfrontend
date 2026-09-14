# v3

Node.js-side v3 protocol: a session-keyed envelope with no shared secret, wired to the Node.js crypto module.

## Overview

`createProtocol(logger)` returns a [`ProtocolProvider`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-ProtocolProvider). Bound to a session by [`createChannel`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-createChannel), each instance mints a random 32-byte nonce and an ephemeral P-256 key pair and advertises them in a 99-byte hello frame (`channel.hello()`); the peer's hello goes to `channel.acceptHello(frame)`, after which two AES-GCM-256 keys, one per direction, are derived from the agreement with HKDF-SHA256 under info strings that name the protocol and both identities. The first hello keys the session, a byte-for-byte repeat of it is a duplicate, anything else is rejected, and a live session is never rekeyed.

Every sealed frame carries its counter in the clear as the nonce and authenticates its ten-byte header; a frame whose counter is not above the last accepted one is rejected before decryption, and a frame from any other session fails to authenticate.

[`V3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v3/#api-V3) is the protocol's definition, `{ id: 'v3', version: 3 }`: the identifier a session names and the byte every frame starts with.

## What v3 protects against

A party that can only listen to the hello exchange and the traffic cannot read or forge frames. A party that can post its own hello before the peer's arrives can complete a v3 handshake as that peer, because nothing authenticates who said hello. Choose [`/node/v4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v4/) when the counterpart must be authenticated. Neither protocol hides the hello: nonces and public keys are public by design.

## Usage

```typescript
import { parentPort } from 'node:worker_threads'
import { createProtocol } from '@hyperfrontend/network-protocol/node/v3'
import { createChannel } from '@hyperfrontend/network-protocol/node/channel'
import { createLogger } from '@hyperfrontend/logging'

const channel = createChannel('main-to-worker', {
  send: (frame) => parentPort.postMessage(frame, [frame.buffer]),
  receive: (packet) => handle(packet.data.message),
  protocolProvider: createProtocol(createLogger({ level: 'info' })),
  session: { protocol: 'v3', role: 'responder', localId, peerId },
})
parentPort.postMessage(await channel.hello())
parentPort.on('message', (frame: Uint8Array) => (channel.isHello(frame) ? channel.acceptHello(frame) : channel.receive(frame)))
```

## Notes

- Session setup costs one ECDH agreement plus one HKDF expansion per direction; each frame costs one AES-GCM operation. Keys are derived once, on the first seal or open after the peer's hello is accepted, and product traffic sent before then waits inside the seal stage.
- A rejected frame reaches [`onDrop`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-ChannelOptions-prop-onDrop) with a [`ProtocolError`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/security/#api-ProtocolError) as [`cause`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-PacketDrop-prop-cause); `getProtocolErrorCode(drop.cause)` from [`/security`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/security/) names the reason (`unsupported-version`, [`replayed`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/security/#api-ProtocolErrorCode), `authentication-failed`, [`malformed`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/security/#api-ProtocolErrorCode), `counter-exhausted`, or `invalid-session`).
- The browser counterpart lives at [`/browser/v3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v3/) and produces identical frames.
