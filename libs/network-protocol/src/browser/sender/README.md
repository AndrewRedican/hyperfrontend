# sender

Browser-side outbound packet sender with serialization and encryption pre-wired.

`createSender` builds a `Sender` from a `SendFn` transport callback (typically `target.postMessage`, a `WebSocket.send`, or a `Worker.postMessage`) and the protocol-specific encryption pipeline. The returned sender exposes the `OutboundQueue` / `OutboundQueues` interface so callers can enqueue messages without thinking about packet construction; serialization, encryption, and obfuscation happen inside the queue before the wire callback fires. Pair with `/browser/receiver` on the other end and a protocol from `/browser/v1` or `/browser/v2`.
