# v1

Browser-side V1 protocol: dynamic key exchange with time-based packet obfuscation.

V1 establishes per-channel encryption keys with a `FirstMessageHandler` handshake, so neither end needs a pre-shared secret. Once established, the dynamic key encrypts the application payload while the obfuscation layer rotates a time-derived password (`getTimeBasedPassword` / `getTimeBasedPasswords`) on a configurable interval to harden against passive replay analysis. This entry point composes the `lib/protocol/v1` factory with browser-specific cryptography and string-encoding adapters and exposes `createProtocol` plus the supporting type surface. Use V1 when you need a zero-config secure channel and can tolerate the handshake round-trip; use `/browser/v2` when both ends share a long-lived secret.
