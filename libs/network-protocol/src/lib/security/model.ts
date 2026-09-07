/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PacketOpener, PacketSealer } from '../packet/model'

export type { PacketSealer, PacketOpener }

/** Which side of the handshake this endpoint played */
export type SessionRole = 'initiator' | 'responder'

/**
 * What a protocol needs to key one session: the negotiated protocol, this side's role,
 * and both identities. The key material itself is minted by the protocol and exchanged
 * through hello frames once the session exists.
 */
export interface ProtocolSession {
  /** The negotiated protocol identifier */
  readonly protocol: string
  /** Whether this endpoint initiated or answered the handshake */
  readonly role: SessionRole
  /** This endpoint's identity as stamped on packets */
  readonly localId: string
  /** The peer's identity as stamped on packets */
  readonly peerId: string
}

/**
 * What accepting a hello frame did.
 *
 * - `accepted`: the peer's material is now known and the session can be keyed
 * - `duplicate`: the same material was already accepted; a retry, ignored
 * - `rejected`: the frame is not a hello this session can use
 */
export type HelloOutcome = 'accepted' | 'duplicate' | 'rejected'

/** Suite of the two per-session packet operations */
export interface SecuritySuite<T = any> {
  /** Seals outgoing packets */
  readonly seal: PacketSealer<T>
  /** Opens incoming frames */
  readonly open: PacketOpener<T>
}
