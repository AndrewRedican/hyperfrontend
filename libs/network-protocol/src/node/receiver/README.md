# receiver

Node.js-side inbound pipeline: frames in, opened packets out.

`createReceiver(label, receivePacket, logger, open, onDrop?)` builds a `Receiver` from a `ReceivePacketFn` callback that takes each opened `UnencryptedPacket` and the session's `PacketOpener` (`protocol.open`). `receiver.receive(frame)` takes the raw bytes from a TCP socket data event, a `process.on('message', ...)` IPC handler, or a WebSocket message handler; a single open queue opens one frame at a time, which keeps the session's replay counter exact, and delivers each packet in order. A frame that is forged, replayed, malformed, or from another session is reported through `onDrop` and never delivered. Hello frames belong to the protocol's `acceptHello`, not to the receiver. Pair with `/node/sender` on the other end and a protocol from `/node/v3` or `/node/v4`; a channel from `/node/channel` creates both for you. Function signatures match `/browser/receiver` so cross-runtime communication is symmetric.
