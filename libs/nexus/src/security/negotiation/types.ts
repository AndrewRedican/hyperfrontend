/**
 * Internal types for protocol negotiation.
 *
 * @module security/negotiation/types
 */

import type { SecurityProtocolVersion } from '../../types/security'

/**
 * Result of protocol negotiation between initiator and responder.
 */
export interface NegotiationResult {
  /** The negotiated protocol version */
  readonly negotiated: SecurityProtocolVersion
  /** Whether the negotiated protocol was the initiator's preferred choice */
  readonly isPreferred: boolean
}
