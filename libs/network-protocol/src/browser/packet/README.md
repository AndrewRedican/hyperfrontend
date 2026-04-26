# packet

Browser-side packet encryption, serialization, and obfuscation pipeline with dynamic-key support.

A packet is the on-the-wire unit produced from a `Data<T>` envelope after encryption, serialization, and obfuscation. This entry point binds the runtime-agnostic `lib/packet` factories to `@hyperfrontend/cryptography/browser` (Web Crypto AES-GCM) and `@hyperfrontend/string-utils/browser` (`TextEncoder` / `btoa`-based base64), exposing `encryptPacket`, `decryptPacket`, `obfuscatePacket`, `deobfuscatePacket`, and the high-level `createSerializedEncryptedPacket` / `createDeserializedEncryptedPacket` builders. Used by the `/browser/v1` and `/browser/v2` protocols to assemble outgoing wire packets and parse incoming ones.
