# sender

Browser-side outbound pipeline: packets in, sealed frames out.

`createSender(label, sendPacket, logger, seal, onDrop?)` builds a `Sender` from a `SendPacketFn` transport callback (typically `target.postMessage`, a `WebSocket.send`, or a `Worker.postMessage`) and the session's `PacketSealer` (`protocol.seal`). `sender.send(origin, target, data)` validates the packet synchronously, then a single seal queue produces each wire frame in order and hands it to the callback; a packet the sealer rejects is reported through `onDrop` rather than thrown. The sender exposes `stop`, `resume`, and `queue.size` for backpressure. Pair with `/browser/receiver` on the other end and a protocol from `/browser/v3` or `/browser/v4`; a channel from `/browser/channel` creates both for you.
