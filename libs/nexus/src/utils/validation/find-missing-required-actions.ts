import type { IChannelContract } from '../../types/contract'

/**
 * Finds the required inputs a counterpart's contract fails to provide.
 *
 * The gate is directional and permissive by default: only `accepted` entries
 * flagged `required` are checked, and each must appear in the counterpart's
 * `emitted` list by type name. Unflagged vocabulary never gates — a peer that
 * emits unknown types is compatible (unknown inbound types are dropped and
 * logged at receive), and a peer that emits nothing we merely *may* react to
 * is compatible too. This keeps additive contract evolution non-breaking in
 * both directions.
 *
 * @param own - Contract of the local side (its `required` accepted entries are checked)
 * @param peer - Contract declared by the counterpart (its `emitted` list must satisfy them)
 * @returns Type names of required inputs the peer does not emit (empty when compatible)
 *
 * @example Gating a connection at accept time
 * ```typescript
 * const own = { accepted: [{ type: 'ping', required: true }], emitted: [] }
 * const peer = { accepted: [], emitted: [{ type: 'pong' }] }
 * findMissingRequiredActions(own, peer) // => ['ping']
 * ```
 */
export function findMissingRequiredActions(own: IChannelContract, peer: IChannelContract): string[] {
  const peerEmittedTypes = peer.emitted.map((action) => action.type)
  return own.accepted.filter((action) => action.required === true && !peerEmittedTypes.includes(action.type)).map((action) => action.type)
}
