# v4

Node.js-side v4 protocol: the session-keyed envelope with a shared secret mixed in, wired to the Node.js crypto module.

## Overview

`createProtocol(logger, sharedKey)` returns a [`ProtocolProvider`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-ProtocolProvider) used exactly like [`/node/v3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v3/)'s: the same hello exchange, the same frames, the same replay rule. The difference is the key schedule: the shared key is stretched once per session with PBKDF2-SHA256 (600,000 iterations, salted with both hellos' nonces) and appended to the ECDH shared secret before the HKDF-SHA256 expansion, so the session is bound to the key. Without it a party can neither read frames nor produce frames the counterpart accepts, a key mismatch is detected because no frame ever authenticates, and a key that leaks later does not expose earlier sessions, whose ephemeral agreements are gone.

[`V4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v4/#api-V4) is the protocol's definition, `{ id: 'v4', version: 4 }`: the identifier a session names and the byte every frame starts with.

## The shared key

The key must be a string of at least [`MIN_SHARED_KEY_LENGTH`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v4/#api-MIN_SHARED_KEY_LENGTH) (16) characters; `isValidSharedKey(value)` checks exactly that, and [`createProtocol`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v4/#api-createProtocol) throws for a shorter key. The guarantee holds for a generated key of 128 bits or more (for example 32 hex characters from a secure random source). A party that can run a hello exchange against this side can test key guesses offline afterwards, so a human-chosen passphrase is not a substitute.

## Usage

```typescript
import { parentPort } from 'node:worker_threads'
import { createProtocol } from '@hyperfrontend/network-protocol/node/v4'
import { createChannel } from '@hyperfrontend/network-protocol/node/channel'
import { createLogger } from '@hyperfrontend/logging'

const channel = createChannel('main-to-worker', {
  send: (frame) => parentPort.postMessage(frame, [frame.buffer]),
  receive: (packet) => handle(packet.data.message),
  protocolProvider: createProtocol(createLogger({ level: 'info' }), sharedKey),
  session: { protocol: 'v4', role: 'responder', localId, peerId },
})
parentPort.postMessage(await channel.hello())
parentPort.on('message', (frame: Uint8Array) => (channel.isHello(frame) ? channel.acceptHello(frame) : channel.receive(frame)))
```

## Notes

- Session setup costs one ECDH agreement, one PBKDF2-SHA256 stretch, and one HKDF expansion per direction; each frame costs one AES-GCM operation. The stretch is paid once per session, not per message, so it lands on the handshake rather than on traffic.
- A side holding a different key derives different keys: every frame from it is reported through [`onDrop`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-ChannelOptions-prop-onDrop) with code `authentication-failed` and nothing is delivered.
- The browser counterpart lives at [`/browser/v4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v4/) and produces identical frames.
