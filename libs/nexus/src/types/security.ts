/**
 * Security types for the nexus protocol security layer.
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
 * - `'v3'`: Ephemeral session keys agreed over the wire; defeats passive listeners
 * - `'v4'`: Ephemeral session keys bound to a pre-shared key; defeats any script without the key
 * - `'none'`: No security, plaintext passthrough
 *
 * Any other string is accepted so external protocol packages can introduce
 * their own identifiers.
 */
export type SecurityProtocolVersion = 'none' | 'v3' | 'v4' | (string & {})

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
}

/**
 * Security confirmation sent in the `OPEN_CONNECTION` action.
 *
 * Confirms which protocol the initiator attached, or that it attached none.
 */
export interface SecurityConfirmation {
  /** Whether an encrypted transport is attached */
  readonly active: boolean

  /** The protocol the transport runs, or `'none'` */
  readonly protocol: SecurityProtocolVersion
}

/**
 * Codes carried by `security-error` events and transport error handlers.
 *
 * The first six are the wire protocol's verdicts on a single frame; the
 * remaining codes describe the transport around the protocol.
 *
 * - `'unsupported-version'`: the frame carries another protocol's version byte
 * - `'replayed'`: the frame's counter is not newer than the last accepted one
 * - `'authentication-failed'`: the frame was not sealed under the session keys
 * - `'malformed'`: the frame or the envelope it carried is not well-formed
 * - `'counter-exhausted'`: the session sealed its last frame
 * - `'invalid-session'`: the session keys cannot be derived
 * - `'hello-rejected'`: a hello arrived that differs from the one keying the session
 * - `'security-unconfirmed'`: the counterpart did not confirm the session before the deadline
 * - `'transport-error'`: a packet could not be sealed or handed to the wire
 * - `'unknown'`: an error without a recognised code
 */
export type SecurityErrorCode =
  | 'unsupported-version'
  | 'replayed'
  | 'authentication-failed'
  | 'malformed'
  | 'counter-exhausted'
  | 'invalid-session'
  | 'hello-rejected'
  | 'security-unconfirmed'
  | 'transport-error'
  | 'unknown'

/**
 * Error payload delivered to a security transport's `onError` handler.
 */
export interface SecurityTransportError {
  /** Human-readable error message */
  readonly message: string
  /** Machine-readable error code */
  readonly code: SecurityErrorCode
  /** Optional underlying cause */
  readonly cause?: unknown
}

/**
 * Data envelope carried inside each sealed frame.
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
  /** The transported message payload */
  readonly message: unknown
  /** JSON schema describing the message */
  readonly schema: Schema
  /** SHA-256 hash of the serialized schema */
  readonly schemaHash: string
}

/**
 * A packet the wire pipeline opened and delivered.
 */
export interface SecurityPacket {
  /** UUID of the packet sender */
  readonly origin: string
  /** UUID of the intended recipient */
  readonly target: string
  /** Opened data envelope; the transported action lives at `data.message` */
  readonly data: SecurityPacketData
}

/**
 * Callback that transmits a sealed frame over the wire.
 */
export type SecuritySendPacket = (frame: Uint8Array) => void

/**
 * Callback invoked with each opened inbound packet.
 */
export type SecurityReceivePacket = (packet: SecurityPacket) => void

/**
 * Which side of the handshake a session endpoint is.
 *
 * The initiator sent the connection request; the responder accepted it. The
 * roles order the session's key material, so both endpoints must agree.
 */
export type SecuritySessionRole = 'initiator' | 'responder'

/**
 * The session a wire protocol instance protects.
 *
 * Structural mirror of network-protocol's `ProtocolSession` shape.
 */
export interface SecuritySession {
  /** Identifier of the negotiated protocol */
  readonly protocol: SecurityProtocolVersion
  /** This endpoint's handshake role */
  readonly role: SecuritySessionRole
  /** Broker id of this endpoint */
  readonly localId: string
  /** Broker id of the counterpart */
  readonly peerId: string
}

/**
 * What a protocol instance made of a counterpart's hello.
 *
 * - `'accepted'`: the hello keyed the session
 * - `'duplicate'`: the hello repeats the one that keyed the session
 * - `'rejected'`: the hello differs from the one that keyed the session
 */
export type SecurityHelloOutcome = 'accepted' | 'duplicate' | 'rejected'

/**
 * Wire-protocol instance driving one channel's session.
 *
 * Structural mirror of network-protocol's `Protocol` shape.
 */
export interface SecurityWireProtocol {
  /** Seals a packet into a frame under the session's sending key */
  readonly seal: (packet: SecurityPacket) => Promise<Uint8Array>
  /** Opens a frame into a packet under the session's receiving key */
  readonly open: (frame: Uint8Array) => Promise<SecurityPacket>
  /** Produces this endpoint's hello frame */
  readonly hello: () => Promise<Uint8Array>
  /** Whether a frame is a hello of this protocol */
  readonly isHello: (frame: Uint8Array) => boolean
  /** Feeds the counterpart's hello to the session */
  readonly acceptHello: (frame: Uint8Array) => SecurityHelloOutcome
  /** Transmits sealed frames */
  readonly send: SecuritySendPacket
  /** Receives opened packets */
  readonly receive: SecurityReceivePacket
  /** Returns the logger used by the protocol */
  readonly getLogger: () => Logger
}

/**
 * Creates a {@link SecurityWireProtocol} for one session.
 *
 * Structural mirror of network-protocol's `ProtocolProvider` shape.
 */
export type SecurityProtocolProvider = (
  send: SecuritySendPacket,
  receive: SecurityReceivePacket,
  session: SecuritySession
) => SecurityWireProtocol

/**
 * The per-channel wire pipeline created by a {@link SecurityChannelFactory}.
 *
 * Structural mirror of the network-protocol channel surface nexus drives.
 */
export interface SecurityWireChannel {
  /** Human-readable pipeline label */
  readonly label: string
  /** Seals and transmits a data envelope from origin to target */
  readonly send: (origin: string, target: string, data: SecurityPacketData) => void
  /** Feeds a sealed frame into the opening pipeline */
  readonly receive: (frame: Uint8Array) => void
  /** Pauses packet processing */
  readonly stop: () => void
  /** Resumes packet processing */
  readonly resume: () => void
  /** Produces this endpoint's hello frame */
  readonly hello: () => Promise<Uint8Array>
  /** Whether a frame is a hello of the channel's protocol */
  readonly isHello: (frame: Uint8Array) => boolean
  /** Feeds the counterpart's hello to the session */
  readonly acceptHello: (frame: Uint8Array) => SecurityHelloOutcome
}

/**
 * A packet the wire pipeline rejected and discarded.
 *
 * Structural mirror of network-protocol's `PacketDrop` shape.
 */
export interface SecurityPacketDrop {
  /** Whether the packet was leaving (`outbound`) or arriving (`inbound`) */
  readonly direction: 'inbound' | 'outbound'
  /** The pipeline stage that rejected the packet */
  readonly stage: 'seal' | 'open'
  /** Why the stage rejected it */
  readonly reason: string
  /** The error the stage raised, when it raised one */
  readonly cause?: unknown
  /** The packet as the stage received it */
  readonly packet: unknown
}

/**
 * What a {@link SecurityChannelFactory} needs to build one channel's pipeline.
 *
 * Structural mirror of network-protocol's `ChannelOptions` shape.
 */
export interface SecurityChannelOptions {
  /** Transmits each sealed frame */
  readonly send: SecuritySendPacket
  /** Receives each opened packet */
  readonly receive: SecurityReceivePacket
  /** Creates the protocol instance for the session */
  readonly protocolProvider: SecurityProtocolProvider
  /** The session the pipeline protects */
  readonly session: SecuritySession
  /** Receives every packet either direction of the pipeline discards */
  readonly onDrop?: (drop: SecurityPacketDrop) => void
}

/**
 * Builds the wire pipeline for one channel.
 *
 * Structural mirror of network-protocol's `createChannel` signature.
 */
export type SecurityChannelFactory = (label: string, options: SecurityChannelOptions) => SecurityWireChannel

/**
 * Everything nexus needs from a security implementation to run one
 * channel's session. This is the boundary a security package implements:
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

  /** This endpoint's handshake role */
  readonly role: SecuritySessionRole

  /** Interval between hello retries until the counterpart confirms the session */
  readonly helloRetryMs?: number

  /** How long the counterpart has to confirm the session after the transport starts */
  readonly confirmTimeoutMs?: number

  /** Receives each action delivered by the transport */
  readonly onAction: (action: unknown) => void

  /** Optional handler for security failures */
  readonly onError?: (error: SecurityTransportError) => void

  /** Optional handler invoked once, when the counterpart's first frame authenticates */
  readonly onConfirmed?: () => void

  /** Optional handler invoked when the session can no longer be confirmed */
  readonly onFailed?: (error: SecurityTransportError) => void
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
   * For `'none'` protocol, the action passes through unchanged. For any
   * other protocol the action is sealed and posted to the counterpart
   * window as a `Uint8Array`; until the session is keyed it waits inside
   * the pipeline.
   *
   * @param action - The action to send
   */
  send(action: unknown): void

  /**
   * Feed a received wire frame into the pipeline.
   *
   * Hello frames key the session; sealed frames are opened and their
   * actions surface through the `onAction` handler supplied at construction.
   *
   * @param frame - The raw wire frame to process
   */
  receive(frame: Uint8Array): void

  /**
   * Start the session's hello exchange and the confirmation deadline.
   *
   * Idempotent; the plaintext transport has nothing to start.
   */
  start(): void

  /**
   * Stop processing for backpressure control.
   */
  stop(): void

  /**
   * Resume processing after stop.
   */
  resume(): void

  /**
   * Release the transport: clears its timers and refuses further work.
   *
   * Frames already inside the seal stage still leave once sealed, so a
   * channel's last words reach the counterpart; every later call is ignored.
   */
  dispose(): void

  /**
   * Get the active security protocol version.
   *
   * @returns The configured protocol version
   */
  getProtocol(): SecurityProtocolVersion
}

/**
 * Bag of pre-registered security protocol providers indexed by protocol version.
 */
export interface SecurityProtocolProviders {
  /** Protocol v3 provider */
  readonly v3?: SecurityProvider
  /** Protocol v4 provider */
  readonly v4?: SecurityProvider
}

/**
 * Broker-level security configuration.
 *
 * Registers protocol providers for all channels managed by the broker.
 */
export interface BrokerSecurityConfig {
  /** Pre-registered protocol providers keyed by version */
  readonly protocols?: SecurityProtocolProviders
}

/**
 * Channel-level security settings.
 */
export interface ChannelSecuritySettings {
  /** Protocol the channel negotiates; the handshake accepts no other encrypted outcome */
  readonly protocol?: SecurityProtocolVersion

  /** Disable security even if the broker registered providers */
  readonly disabled?: boolean

  /**
   * How the channel behaves when it selects a protocol but the handshake
   * cannot deliver it (the counterpart predates security, offers no common
   * protocol, selects another one, or the negotiated provider is missing).
   *
   * - `'fail-open'` (default): fall back to plaintext with a warning
   * - `'fail-closed'`: refuse the connection with reason `'security-unavailable'`
   */
  readonly mode?: 'fail-open' | 'fail-closed'
}
