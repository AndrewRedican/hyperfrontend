/**
 * The types and errors a security protocol implements: the per-session seal and open
 * operations, the session, the hello exchange outcome, and the rejection codes.
 *
 * @module @hyperfrontend/network-protocol/security
 */
export type { ProtocolError } from './errors'
export type { PacketSealer, PacketOpener, SessionRole, ProtocolSession, HelloOutcome, SecuritySuite } from './model'
export { createProtocolError, getProtocolErrorCode, ProtocolErrorCode } from './errors'
