/**
 * Security types for Nexus protocol security layer integration.
 *
 * These types define the security negotiation, transport, and configuration
 * interfaces used during the connection handshake and message flow.
 *
 * @module types/security
 */

/**
 * Security protocol version identifiers.
 *
 * - `'v1'`: Obfuscation-first handshake with dynamic key exchange
 * - `'v2'`: Pre-shared key (PSK) handshake with dynamic key rotation
 * - `'none'`: No security, plaintext passthrough
 */
export type SecurityProtocolVersion = 'v1' | 'v2' | 'none'

/**
 * Security negotiation request sent by the initiator during handshake.
 *
 * The initiator includes this in the `REQUEST_CONNECTION` action to
 * advertise its security capabilities and preferences.
 */
export interface SecurityNegotiationRequest {
  /** Supported protocols in order of preference (most preferred first) */
  readonly supported: readonly SecurityProtocolVersion[]

  /** Preferred protocol (first in supported list) */
  readonly preferred: SecurityProtocolVersion
}

/**
 * Security negotiation response sent by the responder during handshake.
 *
 * The responder includes this in the `ACCEPT_CONNECTION` action to
 * communicate the negotiated protocol.
 */
export interface SecurityNegotiationResponse {
  /** Negotiated protocol (best match between initiator and responder) */
  readonly negotiated: SecurityProtocolVersion

  /** Optional public parameters for protocol initialization (e.g., key exchange hints) */
  readonly publicParams?: Readonly<Record<string, unknown>>
}

/**
 * Security confirmation sent in the `OPEN_CONNECTION` action.
 *
 * Confirms that the security transport is active and ready.
 */
export interface SecurityConfirmation {
  /** Whether security transport is active */
  readonly active: boolean

  /** The active security protocol */
  readonly protocol: SecurityProtocolVersion
}

/**
 * Configuration for creating a security transport adapter.
 */
export interface SecurityTransportConfig {
  /** Security protocol version to use */
  readonly protocol: SecurityProtocolVersion

  /** Protocol provider from network-protocol (required for v1/v2) */
  readonly provider?: unknown

  /** Pre-shared key (required for v2) */
  readonly sharedKey?: string

  /** Key rotation interval in minutes */
  readonly refreshRate?: number

  /** Target window for postMessage */
  readonly target: Window

  /** Allowed origin for incoming messages */
  readonly origin?: string

  /** Optional error handler for security failures */
  readonly onError?: (error: {
    /** Human-readable error message */
    message: string
    /** Machine-readable error code */
    code: string
    /** Optional underlying cause */
    cause?: Error
  }) => void
}

/**
 * Security transport adapter interface.
 *
 * Wraps the network-protocol security pipeline and provides a simple
 * send/receive interface for nexus channels.
 */
export interface SecurityTransport {
  /**
   * Send an action through the security pipeline.
   *
   * For `'none'` protocol, the action passes through unchanged.
   * For `'v1'`/`'v2'`, the action is encrypted and obfuscated.
   *
   * @param action - The action to send
   */
  send(action: unknown): void

  /**
   * Register a handler for decrypted incoming actions.
   *
   * @param handler - Callback invoked with decrypted actions
   */
  onReceive(handler: (action: unknown) => void): void

  /**
   * Stop processing for backpressure control.
   */
  stop(): void

  /**
   * Resume processing after stop.
   */
  resume(): void

  /**
   * Check if transport is ready for secure message exchange.
   *
   * @returns True if transport is initialized and ready
   */
  isReady(): boolean

  /**
   * Get the active security protocol version.
   *
   * @returns The configured protocol version
   */
  getProtocol(): SecurityProtocolVersion
}

/**
 * Function signature for lazily loading protocol providers.
 *
 * Consumers can provide this function to enable on-demand loading
 * of security protocols from bundles, CDNs, or dynamic imports.
 *
 * @param version - The protocol version to load ('v1' or 'v2')
 * @param platform - The target platform ('browser' or 'node')
 * @returns Promise resolving to the protocol provider
 */
export type ProtocolLoader = (version: 'v1' | 'v2', platform: 'browser' | 'node') => Promise<unknown>

/**
 * Broker-level security configuration.
 *
 * Configures security defaults and protocol availability for all
 * channels managed by the broker.
 */
export interface BrokerSecurityConfig {
  /** Pre-registered protocol providers keyed by version */
  readonly protocols?: Readonly<{
    /** Protocol v1 provider */
    v1?: unknown
    /** Protocol v2 provider */
    v2?: unknown
  }>

  /** Protocol loader for lazy loading */
  readonly protocolLoader?: ProtocolLoader

  /** Default security protocol for new channels */
  readonly defaultProtocol?: SecurityProtocolVersion

  /** Default shared key for v2 protocol (can be overridden per-channel) */
  readonly defaultSharedKey?: string

  /** Default key rotation interval in minutes */
  readonly defaultRefreshRate?: number
}

/**
 * Channel-level security settings.
 *
 * Allows per-channel override of broker security defaults.
 */
export interface ChannelSecuritySettings {
  /** Protocol override for this channel */
  readonly protocol?: SecurityProtocolVersion

  /** Channel-specific shared key for v2 */
  readonly sharedKey?: string

  /** Channel-specific key rotation interval in minutes */
  readonly refreshRate?: number

  /** Disable security even if broker has a default protocol */
  readonly disabled?: boolean
}
