# v4

Browser-side v4 protocol: the session-keyed envelope with a shared secret mixed in, wired to the Web Crypto API.

## Overview

`createProtocol(logger, sharedKey)` returns a [`ProtocolProvider`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-ProtocolProvider) used exactly like [`/browser/v3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v3/)'s: the same hello exchange, the same frames, the same replay rule. The difference is the key schedule: the shared key is stretched once per session with PBKDF2-SHA256 (600,000 iterations, salted with both hellos' nonces) and appended to the ECDH shared secret before the HKDF-SHA256 expansion, so the session is bound to the key. Without it a script can neither read frames nor produce frames the counterpart accepts, a key mismatch is detected because no frame ever authenticates, and a key that leaks later does not expose earlier sessions, whose ephemeral agreements are gone.

[`V4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v4/#api-V4) is the protocol's definition, `{ id: 'v4', version: 4 }`: the identifier a session names and the byte every frame starts with.

## The shared key

The key must be a string of at least [`MIN_SHARED_KEY_LENGTH`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v4/#api-MIN_SHARED_KEY_LENGTH) (16) characters; `isValidSharedKey(value)` checks exactly that, and [`createProtocol`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/v4/#api-createProtocol) throws for a shorter key. The guarantee holds for a generated key of 128 bits or more (for example 32 hex characters from a secure random source). A party that can run a hello exchange against this side can test key guesses offline afterwards, so a human-chosen passphrase is not a substitute.

## Usage

```typescript
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v4'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createLogger } from '@hyperfrontend/logging'

const channel = createChannel('app-to-widget', {
  send: (frame) => otherWindow.postMessage(frame, origin, [frame.buffer]),
  receive: (packet) => handle(packet.data.message),
  protocolProvider: createProtocol(createLogger({ level: 'info' }), sharedKey),
  session: { protocol: 'v4', role: 'initiator', localId, peerId },
})
otherWindow.postMessage(await channel.hello(), origin)
window.addEventListener('message', ({ data }) => (channel.isHello(data) ? channel.acceptHello(data) : channel.receive(data)))
```

## Notes

- Session setup costs one ECDH agreement, one PBKDF2-SHA256 stretch, and one HKDF expansion per direction; each frame costs one AES-GCM operation. The stretch is paid once per session, not per message, so it lands on the handshake rather than on traffic.
- A side holding a different key derives different keys: every frame from it is reported through [`onDrop`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-ChannelOptions-prop-onDrop) with code `authentication-failed` and nothing is delivered.
- The Node.js counterpart lives at [`/node/v4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v4/) and produces identical frames.
