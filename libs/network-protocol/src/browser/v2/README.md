# v2

Browser-side V2 protocol: pre-shared-key handshake encryption with time-based packet obfuscation.

V2 assumes both ends already share a long-lived secret (a PSK), so there is no first-message key-exchange round-trip; the encryption key is derived directly from the PSK at channel construction time. The obfuscation layer still rotates a time-derived password (`getTimeBasedPassword` / `getTimeBasedPasswords`) on a configurable interval. This entry point composes the `lib/protocol/v2` `createPSKHandshakeProtocolFactory` with browser-specific cryptography adapters and exposes `createProtocol`. Use V2 when both endpoints can be provisioned with the same secret; use `/browser/v1` when you need zero-config dynamic key exchange.
