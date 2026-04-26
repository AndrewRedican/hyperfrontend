# receiver

Browser-side inbound packet receiver with deserialization and decryption pre-wired.

`createReceiver` builds a `Receiver` from a `ReceiveFn` transport hook (typically a `message` event listener on `window`, a `MessagePort`, or a `Worker`) and the protocol-specific decryption pipeline. The returned receiver exposes the `InboundQueue` / `InboundQueues` interface so application code can subscribe to deserialized application messages without thinking about packet teardown; deobfuscation, decryption, and deserialization happen inside the queue before the application handler fires. Pair with `/browser/sender` on the other end and a protocol from `/browser/v1` or `/browser/v2`.
