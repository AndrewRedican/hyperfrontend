# v1

Node.js-side V1 protocol: dynamic key exchange with time-based packet obfuscation.

V1 establishes per-channel encryption keys with a `FirstMessageHandler` handshake, so neither end needs a pre-shared secret. Once established, the dynamic key encrypts the application payload while the obfuscation layer rotates a time-derived password (`getTimeBasedPassword` / `getTimeBasedPasswords`) on a configurable interval to harden against passive replay analysis. This entry point composes the `lib/protocol/v1` factory with `@hyperfrontend/cryptography/node` and exposes `createProtocol` plus the supporting type surface. Wire-compatible with `/browser/v1`, so a Node service and a browser client can negotiate a V1 channel end-to-end. Use V1 when you need a zero-config secure channel; use `/node/v2` when both ends share a long-lived secret.
