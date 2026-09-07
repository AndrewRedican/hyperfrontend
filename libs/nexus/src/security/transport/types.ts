/**
 * Internal transport types for the security layer.
 *
 * These types are used by the transport implementations and not
 * exported from the main nexus API.
 *
 * @module security/transport/types
 */

import type { SecurityProtocolVersion, SecurityProvider, SecuritySessionRole, SecurityTransportError } from '../../types/security'

/**
 * Internal state for tracking transport processing.
 */
export interface TransportState {
  /** Whether processing is currently stopped (backpressure) */
  stopped: boolean
}

/**
 * Handler function type for actions delivered by a transport.
 */
export type ActionHandler = (action: unknown) => void

/**
 * Handler function type for security errors.
 */
export type ErrorHandler = (error: SecurityTransportError) => void

/**
 * Configuration for the none transport (passthrough).
 */
export interface NoneTransportConfig {
  /** Counterpart window that receives outbound traffic */
  readonly target: Window

  /** Returns the origin currently pinned to the channel, or null before pinning */
  readonly getOrigin: () => string | null

  /** Receives each action delivered by the transport */
  readonly onAction: ActionHandler
}

/**
 * Configuration for secure transport (encrypting protocols).
 */
export interface SecureTransportConfig {
  /** Security protocol version */
  readonly protocol: SecurityProtocolVersion

  /** Security implementation building the wire pipeline */
  readonly provider: SecurityProvider

  /** Human-readable label for the wire pipeline */
  readonly label: string

  /** Counterpart window that receives outbound frames */
  readonly target: Window

  /** Returns the origin currently pinned to the channel, or null before pinning */
  readonly getOrigin: () => string | null

  /** UUID identifying the local endpoint, stamped as each packet's origin */
  readonly originId: string

  /** UUID identifying the counterpart endpoint, stamped as each packet's target */
  readonly targetId: string

  /** This endpoint's handshake role */
  readonly role: SecuritySessionRole

  /** Interval between hello retries until the counterpart confirms the session */
  readonly helloRetryMs: number

  /** How long the counterpart has to confirm the session after the transport starts */
  readonly confirmTimeoutMs: number

  /** Receives each opened action delivered by the transport */
  readonly onAction: ActionHandler

  /** Optional error handler for security failures */
  readonly onError?: ErrorHandler

  /** Optional handler invoked once, when the counterpart's first frame authenticates */
  readonly onConfirmed?: () => void

  /** Optional handler invoked when the session can no longer be confirmed */
  readonly onFailed?: ErrorHandler
}
