/**
 * Internal transport types for the security layer.
 *
 * These types are used by the transport implementations and not
 * exported from the main nexus API.
 *
 * @module security/transport/types
 */

import type { SecurityErrorEventData } from '../../types/events'
import type { SecurityProtocolVersion, SecurityTransport } from '../../types/security'

/**
 * Internal state for tracking transport initialization.
 */
export interface TransportState {
  /** Whether the transport has completed initialization */
  ready: boolean

  /** Whether processing is currently stopped (backpressure) */
  stopped: boolean
}

/**
 * Handler function type for receiving decrypted actions.
 */
export type ReceiveHandler = (action: unknown) => void

/**
 * Handler function type for security errors.
 */
export type ErrorHandler = (error: SecurityErrorEventData) => void

/**
 * Configuration for the none transport (passthrough).
 */
export interface NoneTransportConfig {
  /** Target window for postMessage */
  readonly target: Window

  /** Allowed origin for messages (defaults to '*') */
  readonly origin?: string
}

/**
 * Configuration for secure transport (v1/v2 protocols).
 */
export interface SecureTransportConfig {
  /** Security protocol version */
  readonly protocol: 'v1' | 'v2'

  /** Protocol provider from network-protocol */
  readonly provider: unknown

  /** Pre-shared key (required for v2) */
  readonly sharedKey?: string

  /** Key rotation interval in minutes */
  readonly refreshRate?: number

  /** Target window for postMessage */
  readonly target: Window

  /** Allowed origin for messages (defaults to '*') */
  readonly origin?: string

  /** Optional error handler for security failures */
  readonly onError?: ErrorHandler
}

/**
 * Factory function signature for creating security transports.
 */
export type SecurityTransportFactory = (
  protocol: SecurityProtocolVersion,
  config: NoneTransportConfig | SecureTransportConfig
) => SecurityTransport
