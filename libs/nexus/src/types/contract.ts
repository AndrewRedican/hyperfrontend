/** Describes an action that can be sent or received on a channel */
export interface IActionDescription {
  /** Unique identifier for the action type */
  type: string
  /** Human-readable description of the action */
  description?: string
  /** JSON schema for validating action payload */
  schema?: object
  /**
   * Marks an accepted action as essential for correct operation: the
   * connection is denied unless the counterpart emits this type. Only
   * meaningful on `accepted` entries; ignored on `emitted`.
   */
  required?: boolean
}

/**
 * Contract defining the actions a broker or channel exchanges with its counterpart.
 *
 * A contract is self-oriented: it always describes the side that owns it.
 * `emitted` lists the message types this side sends, and `accepted` lists
 * the message types this side is willing to receive. Outgoing messages are
 * validated against `emitted`; incoming messages are validated against
 * `accepted` and silently dropped (with a log entry) when not listed.
 * Accepted entries flagged `required` additionally gate the connection:
 * a counterpart that does not emit them is denied at handshake time.
 */
export interface IChannelContract {
  /** Message types this side sends to its counterpart */
  emitted: IActionDescription[]
  /** Message types this side accepts from its counterpart */
  accepted: IActionDescription[]
  /**
   * Optional version string announcing the contract cut this side holds.
   * Crossed to the counterpart during the handshake and stored on
   * `peerContract`; nexus itself attaches no semantics to it, though a
   * channel-supplied compatibility rule may compare the two announcements.
   */
  version?: string
}

/**
 * Compatible outcome of a contract-compatibility check.
 */
export interface ContractCompatible {
  /** Discriminant marking the pair compatible. */
  compatible: true
}

/**
 * Incompatible outcome of a contract-compatibility check: the connection is
 * denied before it opens.
 */
export interface ContractIncompatible {
  /** Discriminant marking the pair incompatible. */
  compatible: false
  /** Human-readable reason delivered with the connection denial. */
  reason: string
}

/**
 * Outcome of a contract-compatibility check between the two handshake sides.
 */
export type ContractCompatibility = ContractCompatible | ContractIncompatible

/**
 * Channel-supplied rule deciding whether the local contract and the
 * counterpart's declared contract may interoperate.
 *
 * Invoked during the connection handshake alongside the required-actions
 * check, on whichever side holds the rule; an incompatible result denies the
 * connection before it opens, surfacing the reason on the `deny` event.
 *
 * @param own - Contract of the local side.
 * @param peer - Contract declared by the counterpart.
 * @returns The compatibility outcome, with a reason when incompatible.
 */
export type ContractCompat = (own: IChannelContract, peer: IChannelContract) => ContractCompatibility
