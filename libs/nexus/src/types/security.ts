/**
 * Security types for Nexus protocol security layer integration.
 *
 * These types define the security negotiation, transport, and configuration
 * interfaces used during the connection handshake and message flow. The
 * wire-level types are structural mirrors of the network-protocol API so that
 * any security package exposing the same shapes can plug into nexus without
 * nexus depending on a specific implementation.
 *
 * @module types/security
 */

import type { Schema } from '@hyperfrontend/json-utils'
import type { Logger } from '@hyperfrontend/logging'

/**
 * Security protocol identifiers.
 *
 * - `'v1'`: Time-interval obfuscation; peers remain on the protocol's base key
 * - `'v2'`: Pre-shared key (PSK) handshake; encrypted from the first message
 * - `'none'`: No security, plaintext passthrough
 *
 * Any other string is accepted so external protocol packages can introduce
 * their own identifiers.
 */
export type SecurityProtocolVersion = 'none' | 'v1' | 'v2' | (string & {})

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
 * Error payload delivered to a security transport's `onError` handler.
 */
export interface SecurityTransportError {
  /** Human-readable error message */
  message: string
  /** Machine-readable error code */
  code: string
  /** Optional underlying cause */
  cause?: Error
}

/**
 * Data envelope carried inside each wire packet.
 *
 * The transported nexus action lives at {@link SecurityPacketData.message};
 * the remaining fields are wire-protocol bookkeeping.
 */
export interface SecurityPacketData {
  /** UUID identifying the sending process */
  readonly pid: string
  /** UUID identifying this message */
  readonly id: string
  /** Counter incremented for each message of the sending process */
  readonly sequence: number
  /** Key offered for encrypting subsequent traffic (empty to keep the base key) */
  readonly key: string
  /** The transported message payload */
  readonly message: unknown
  /** JSON schema describing the message */
  readonly schema: Schema
  /** SHA-256 hash of the serialized schema */
  readonly schemaHash: string
}

/**
 * A decrypted packet delivered by the wire pipeline.
 */
export interface SecurityPacket {
  /** UUID of the packet sender */
  readonly origin: string
  /** UUID of the intended recipient */
  readonly target: string
  /** Decrypted data envelope; the transported action lives at `data.message` */
  readonly data: SecurityPacketData
}

/**
 * A packet whose data has been encrypted to binary form.
 */
export interface SecurityEncryptedPacket {
  /** UUID of the packet sender */
  readonly origin: string
  /** UUID of the intended recipient */
  readonly target: string
  /** Encrypted data bytes */
  readonly data: Uint8Array
}

/**
 * A packet whose encrypted data has been serialized to a string.
 */
export interface SecuritySerializedPacket {
  /** UUID of the packet sender */
  readonly origin: string
  /** UUID of the intended recipient */
  readonly target: string
  /** Serialized encrypted data */
  readonly data: string
}

/**
 * Callback that transmits obfuscated ciphertext bytes over the wire.
 */
export type SecuritySendPacket = (packet: Uint8Array) => void

/**
 * Callback invoked with each decrypted inbound packet.
 */
export type SecurityReceivePacket = (packet: SecurityPacket) => void

/**
 * Wire-protocol instance driving one channel's encryption pipeline.
 *
 * Structural mirror of network-protocol's `Protocol` shape.
 */
export interface SecurityWireProtocol {
  /** Encrypts a packet's data envelope */
  readonly packetEncryption: (packet: SecurityPacket) => Promise<SecurityEncryptedPacket>
  /** Decrypts a packet's data envelope */
  readonly packetDecryption: (packet: SecurityEncryptedPacket) => Promise<SecurityPacket>
  /** Obfuscates a serialized packet into wire bytes */
  readonly packetObfuscation: (packet: SecuritySerializedPacket) => Promise<Uint8Array>
  /** Deobfuscates wire bytes into a serialized packet */
  readonly packetDeobfuscation: (packet: Uint8Array) => Promise<SecuritySerializedPacket>
  /** Transmits fully processed wire bytes */
  readonly send: SecuritySendPacket
  /** Receives fully decrypted packets */
  readonly receive: SecurityReceivePacket
  /** Returns the logger used by the protocol */
  readonly getLogger: () => Logger
}

/**
 * Creates a {@link SecurityWireProtocol} bound to the given packet callbacks.
 *
 * Structural mirror of network-protocol's `ProtocolProvider` shape.
 */
export type SecurityProtocolProvider = (sendPacket: SecuritySendPacket, receivePacket: SecurityReceivePacket) => SecurityWireProtocol

/**
 * The per-channel wire pipeline created by a {@link SecurityChannelFactory}.
 *
 * Structural mirror of the network-protocol channel surface nexus drives.
 */
export interface SecurityWireChannel {
  /** Human-readable pipeline label */
  readonly label: string
  /** Encrypts and transmits a data envelope from origin to target */
  readonly send: (origin: string, target: string, data: SecurityPacketData) => void
  /** Feeds raw wire bytes into the decryption pipeline */
  readonly receive: (packet: Uint8Array) => void
  /** Pauses packet processing */
  readonly stop: () => void
  /** Resumes packet processing */
  readonly resume: () => void
}

/**
 * Builds the wire pipeline for one channel.
 *
 * Structural mirror of network-protocol's `createChannel` signature.
 */
export type SecurityChannelFactory = (
  label: string,
  sendPacket: SecuritySendPacket,
  receivePacket: SecurityReceivePacket,
  protocolProvider: SecurityProtocolProvider
) => SecurityWireChannel

/**
 * Everything nexus needs from a security implementation to run one
 * channel's envelope. This is the boundary a security package implements:
 * network-protocol's `createChannel` and a protocol provider satisfy it
 * directly.
 */
export interface SecurityProvider {
  /** Builds the per-channel wire pipeline */
  readonly createChannel: SecurityChannelFactory
  /** Creates the protocol instance driving the pipeline */
  readonly protocolProvider: SecurityProtocolProvider
}

/**
 * Configuration for creating a security transport adapter.
 */
export interface SecurityTransportConfig {
  /** Security protocol to use */
  readonly protocol: SecurityProtocolVersion

  /** Security implementation building the wire pipeline (required for protocols other than 'none') */
  readonly provider?: SecurityProvider

  /** Human-readable label for the wire pipeline, surfaced in protocol diagnostics */
  readonly label: string

  /** Counterpart window that receives outbound traffic */
  readonly target: Window

  /** Returns the origin currently pinned to the channel, or null before pinning */
  readonly getOrigin: () => string | null

  /** UUID identifying the local endpoint, stamped as each packet's origin */
  readonly originId: string

  /** UUID identifying the counterpart endpoint, stamped as each packet's target */
  readonly targetId: string

  /** Receives each action delivered by the transport */
  readonly onAction: (action: unknown) => void

  /** Optional handler for transport failures (e.g., unencryptable payloads) */
  readonly onError?: (error: SecurityTransportError) => void
}

/**
 * Security transport adapter interface.
 *
 * Wraps a security wire pipeline and provides a simple send/receive
 * interface for nexus channels.
 */
export interface SecurityTransport {
  /**
   * Send an action through the security pipeline.
   *
   * For `'none'` protocol, the action passes through unchanged.
   * For `'v1'`/`'v2'`, the action is encrypted and obfuscated, then posted
   * to the counterpart window as a `Uint8Array`.
   *
   * @param action - The action to send
   */
  send(action: unknown): void

  /**
   * Feed a received wire payload into the decryption pipeline.
   *
   * Decrypted actions surface through the `onAction` handler supplied at
   * construction.
   *
   * @param packet - The raw wire payload to process
   */
  receive(packet: Uint8Array): void

  /**
   * Stop processing for backpressure control.
   */
  stop(): void

  /**
   * Resume processing after stop.
   */
  resume(): void

  /**
   * Check if the transport can protect product traffic right now.
   *
   * The bundled protocols (`'none'`, `'v1'`, `'v2'`) hold their full
   * protection capability from construction and always report ready.
   * External transports with their own wire handshake may report false
   * until it completes; senders queue product traffic in the meantime.
   *
   * @returns True if the transport is ready for secure message exchange
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
 * Bag of pre-registered security protocol providers indexed by protocol version.
 *
 * Providers are expected to satisfy the {@link SecurityProvider} shape.
 */
export interface SecurityProtocolProviders {
  /** Protocol v1 provider */
  v1?: unknown
  /** Protocol v2 provider */
  v2?: unknown
}

/**
 * Broker-level security configuration.
 *
 * Configures security defaults and protocol availability for all
 * channels managed by the broker.
 */
export interface BrokerSecurityConfig {
  /** Pre-registered protocol providers keyed by version */
  readonly protocols?: Readonly<SecurityProtocolProviders>

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

  /**
   * How the channel behaves when it selects v1/v2 but the handshake cannot
   * deliver an encrypted transport (the counterpart predates security,
   * offers no common protocol, or the negotiated provider is missing).
   *
   * - `'fail-open'` (default): fall back to plaintext with a warning
   * - `'fail-closed'`: refuse the connection with reason `'security-unavailable'`
   */
  readonly mode?: 'fail-open' | 'fail-closed'
}
