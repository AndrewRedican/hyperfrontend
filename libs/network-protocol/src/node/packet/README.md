# packet

Node.js-side packet encryption, serialization, and obfuscation pipeline with dynamic-key support.

A packet is the on-the-wire unit produced from a `Data<T>` envelope after encryption, serialization, and obfuscation. This entry point binds the runtime-agnostic `lib/packet` factories to `@hyperfrontend/cryptography/node` (Node `webcrypto` AES-GCM) and `@hyperfrontend/string-utils/node` (`Buffer`-based base64), exposing `encryptPacket`, `decryptPacket`, `obfuscatePacket`, `deobfuscatePacket`, and the high-level `createSerializedEncryptedPacket` / `createDeserializedEncryptedPacket` builders. Used by the `/node/v1` and `/node/v2` protocols to assemble outgoing wire packets and parse incoming ones. Function signatures match `/browser/packet` so encoded packets cross runtime boundaries cleanly.
