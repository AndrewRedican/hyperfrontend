/** Describes an action that can be sent or received on a channel */
export interface IActionDescription {
  /** Unique identifier for the action type */
  type: string
  /** Human-readable description of the action */
  description?: string
  /** JSON schema for validating action payload */
  schema?: object
}

/**
 * Contract defining the actions a broker or channel exchanges with its counterpart.
 *
 * A contract is self-oriented: it always describes the side that owns it.
 * `emitted` lists the message types this side sends, and `accepted` lists
 * the message types this side is willing to receive. Outgoing messages are
 * validated against `emitted`; incoming messages are validated against
 * `accepted` and silently dropped (with a log entry) when not listed.
 */
export interface IChannelContract {
  /** Message types this side sends to its counterpart */
  emitted: IActionDescription[]
  /** Message types this side accepts from its counterpart */
  accepted: IActionDescription[]
}
