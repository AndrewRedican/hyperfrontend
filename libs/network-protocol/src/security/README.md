# security

Types and errors a security protocol implements: the per-session seal and open operations, the session, the hello exchange outcome, and the rejection codes.

`SecuritySuite` pairs a `PacketSealer` with a `PacketOpener`. `ProtocolSession` (`{ protocol, role, localId, peerId }`, with `SessionRole` as `'initiator' | 'responder'`) is what a `ProtocolProvider` binds a protocol instance to, and `HelloOutcome` (`'accepted' | 'duplicate' | 'rejected'`) is what accepting a peer's hello frame returns. `ProtocolErrorCode` lists why a protocol rejects a frame or a session (`unsupported-version`, `replayed`, `authentication-failed`, `malformed`, `counter-exhausted`, `invalid-session`); `createProtocolError` builds a `ProtocolError` carrying one, and `getProtocolErrorCode` reads the code off a drop's `cause`.
