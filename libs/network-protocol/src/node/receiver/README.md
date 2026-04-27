# receiver

Node.js-side inbound packet receiver with deserialization and decryption pre-wired.

`createReceiver` builds a `Receiver` from a `ReceiveFn` transport hook (typically a TCP socket data event, a `process.on('message', …)` IPC handler, or a WebSocket message handler) and the protocol-specific decryption pipeline. The returned receiver exposes the `InboundQueue` / `InboundQueues` interface so application code can subscribe to deserialized application messages without thinking about packet teardown; deobfuscation, decryption, and deserialization happen inside the queue before the application handler fires. Pair with `/node/sender` on the other end and a protocol from `/node/v1` or `/node/v2`. Function signatures match `/browser/receiver` so cross-runtime communication is symmetric.
