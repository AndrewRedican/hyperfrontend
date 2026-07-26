/**
 * Internal transport types for the security layer.
 *
 * These types are used by the transport implementations and not
 * exported from the main nexus API.
 *
 * @module security/transport/types
 */

import type { SecurityProtocolVersion, SecurityProvider, SecurityTransportError } from '../../types/security'

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

  /** Counterpart window that receives outbound ciphertext */
  readonly target: Window

  /** Returns the origin currently pinned to the channel, or null before pinning */
  readonly getOrigin: () => string | null

  /** UUID identifying the local endpoint, stamped as each packet's origin */
  readonly originId: string

  /** UUID identifying the counterpart endpoint, stamped as each packet's target */
  readonly targetId: string

  /** Receives each decrypted action delivered by the transport */
  readonly onAction: ActionHandler

  /** Optional error handler for security failures */
  readonly onError?: ErrorHandler
}
