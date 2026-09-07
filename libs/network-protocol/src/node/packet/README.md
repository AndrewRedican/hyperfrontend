# packet

Node.js-side packet types, builders, and validators.

A packet is either a plaintext `UnencryptedPacket<T>` (`origin`, `target`, and a `Data<T>` envelope) or the sealed `WirePacket` bytes that carry it. This entry point exposes `createPacketBase` and `createUnencryptedPacket`, the validators `isValidOrigin`, `isValidTarget`, `isValidUnencryptedPacket`, and `isValidWirePacket`, and the operation and drop types (`PacketSealer`, `PacketOpener`, `PacketDrop`, `PacketDropHandler`, `PacketDropStage`) that a session protocol and a channel's `onDrop` handler share. Origins and targets are UUID v4 strings. The `/node/v3` and `/node/v4` protocols convert between the two shapes; `/browser/packet` exports the same code, so packets cross runtime boundaries cleanly.
