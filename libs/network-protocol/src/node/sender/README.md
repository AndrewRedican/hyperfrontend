# sender

Node.js-side outbound packet sender with serialization and encryption pre-wired.

`createSender` builds a `Sender` from a `SendFn` transport callback (typically a TCP socket write, a `process.send` IPC call, or a `WebSocket.send`) and the protocol-specific encryption pipeline. The returned sender exposes the `OutboundQueue` / `OutboundQueues` interface so callers can enqueue messages without thinking about packet construction; serialization, encryption, and obfuscation happen inside the queue before the wire callback fires. Pair with `/node/receiver` on the other end and a protocol from `/node/v1` or `/node/v2`. Function signatures match `/browser/sender` so cross-runtime communication is symmetric.
