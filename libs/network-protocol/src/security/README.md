# security

Type definitions for the encryption and obfuscation suites that the protocol pipelines plug into.

`PacketEncryption`, `PacketDecryption`, `PacketObfuscation`, and `PacketDeobfuscation` describe the per-step transform shapes. `EncryptionSuite`, `ObfuscationSuite`, and `SecuritySuite` are the bundled configurations that runtime-specific protocol factories (`/browser/v1`, `/node/v2`, etc.) supply. `FirstMessageHandler` is the dynamic-key handshake hook, used by V1 protocols to negotiate per-channel encryption keys without a pre-shared secret.
