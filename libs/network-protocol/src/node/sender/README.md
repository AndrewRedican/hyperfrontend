# sender

Node.js-side outbound pipeline: packets in, sealed frames out.

`createSender(label, sendPacket, logger, seal, onDrop?)` builds a `Sender` from a `SendPacketFn` transport callback (typically a TCP socket write, a `process.send` IPC call, or a `WebSocket.send`) and the session's `PacketSealer` (`protocol.seal`). `sender.send(origin, target, data)` validates the packet synchronously, then a single seal queue produces each wire frame in order and hands it to the callback; a packet the sealer rejects is reported through `onDrop` rather than thrown. The sender exposes `stop`, `resume`, and `queue.size` for backpressure. Pair with `/node/receiver` on the other end and a protocol from `/node/v3` or `/node/v4`; a channel from `/node/channel` creates both for you. Function signatures match `/browser/sender` so cross-runtime communication is symmetric.
